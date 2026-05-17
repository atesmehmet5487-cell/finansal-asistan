import httpx
import structlog
from config import get_settings

log = structlog.get_logger()
settings = get_settings()

FINANCE_KEYWORDS = [
    "BIST", "borsa", "hisse", "ASELS", "THYAO", "GARAN", "AKBNK",
    "altın", "dolar", "euro", "faiz", "enflasyon", "TCMB",
    "temettü", "kâr", "zarar", "yatırım",
]

TWITTER_QUERY = " OR ".join(FINANCE_KEYWORDS[:8]) + " lang:tr -is:retweet"


async def fetch_twitter(max_results: int = 50) -> list[dict]:
    if not settings.twitter_bearer_token:
        log.warning("twitter_token_missing")
        return []

    url = "https://api.twitter.com/2/tweets/search/recent"
    headers = {"Authorization": f"Bearer {settings.twitter_bearer_token}"}
    params = {
        "query": TWITTER_QUERY,
        "max_results": max_results,
        "tweet.fields": "created_at,public_metrics,author_id",
        "expansions": "author_id",
        "user.fields": "name,username,public_metrics",
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json()

        users = {u["id"]: u for u in data.get("includes", {}).get("users", [])}
        results = []
        for tweet in data.get("data", []):
            author = users.get(tweet.get("author_id", ""), {})
            metrics = tweet.get("public_metrics", {})
            engagement = (
                metrics.get("like_count", 0) +
                metrics.get("retweet_count", 0) * 2 +
                metrics.get("reply_count", 0) * 1.5
            )
            results.append({
                "source": "twitter",
                "id": tweet["id"],
                "content": tweet.get("text", ""),
                "author": author.get("username", ""),
                "author_followers": author.get("public_metrics", {}).get("followers_count", 0),
                "engagement_score": engagement,
                "created_at": tweet.get("created_at", ""),
                "url": f"https://twitter.com/i/web/status/{tweet['id']}",
            })
        return sorted(results, key=lambda x: x["engagement_score"], reverse=True)
    except Exception as e:
        log.error("twitter_fetch_failed", error=str(e))
        return []


async def fetch_reddit(subreddits: list[str] | None = None) -> list[dict]:
    if not settings.reddit_client_id:
        return []

    subs = subreddits or ["turkey", "investing", "personalfinance"]

    try:
        import praw
        reddit = praw.Reddit(
            client_id=settings.reddit_client_id,
            client_secret=settings.reddit_client_secret,
            user_agent=settings.reddit_user_agent,
        )

        results = []
        for sub_name in subs:
            try:
                sub = reddit.subreddit(sub_name)
                for post in sub.hot(limit=10):
                    text = " ".join(FINANCE_KEYWORDS[:5])
                    if any(kw.lower() in post.title.lower() for kw in FINANCE_KEYWORDS):
                        results.append({
                            "source": "reddit",
                            "id": post.id,
                            "content": post.title + (" — " + post.selftext[:200] if post.selftext else ""),
                            "author": str(post.author) if post.author else "[deleted]",
                            "engagement_score": post.score + post.num_comments * 2,
                            "created_at": str(post.created_utc),
                            "url": f"https://reddit.com{post.permalink}",
                        })
            except Exception:
                continue

        return sorted(results, key=lambda x: x["engagement_score"], reverse=True)
    except Exception as e:
        log.error("reddit_fetch_failed", error=str(e))
        return []


async def fetch_all_social() -> list[dict]:
    tweets = await fetch_twitter()
    reddit_posts = await fetch_reddit()
    all_posts = tweets + reddit_posts
    log.info("social_collected", count=len(all_posts))
    return sorted(all_posts, key=lambda x: x["engagement_score"], reverse=True)
