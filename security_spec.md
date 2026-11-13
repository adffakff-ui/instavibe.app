# Security Specification - InstaVibe

## 1. Data Invariants
- A post must have a valid `authorId` matching the authenticated user.
- A comment must belong to an existing post.
- A story expires after 24 hours (enforced by application logic, but rules should restrict old reads if possible).
- Users can only edit or delete their own posts, comments, and stories.
- A user can only follow another user once.
- Like operations must be atomic (decrement/increment happens in the app, but rules ensure the user can only like a post once).

## 2. The "Dirty Dozen" Payloads (Denial Targets)
1. **Identity Spoofing**: Creating a post with another user's `authorId`.
2. **Post Hijacking**: Updating another user's post caption.
3. **Ghost Metadata**: Adding `isVerified: true` to a user profile.
4. **Unbounded Tags**: Adding an array of 10,000 tags to a post.
5. **Relational Orphan**: Creating a comment on a non-existent `postId`.
6. **Self-Promotion**: Updating own `likesCount` manually without a `Like` document.
7. **Comment Deletion**: Deleting someone else's comment on your post (actually, Instagram allows this, but let's check).
8. **Follow Spoofing**: Creating a follow record on behalf of someone else.
9. **Story Immortality**: Trying to update a story's `createdAt` to extend its life.
10. **Resource Exhaustion**: Sending a 1MB string as a username.
11. **Negative Likes**: Updating `likesCount` to -1.
12. **Anonymous Spam**: Writing to the feed without being logged in.

## 3. Implementation Strategy
- Use `isValidUser`, `isValidPost`, `isValidStory`, etc.
- Enforce `request.auth.uid == authorId`.
- Use `affectedKeys().hasOnly()` for partial updates (e.g., likes count).
- Validate ID formats and string lengths.
