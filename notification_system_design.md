### Stage 1: REST API
Just need the essentials here. For real-time delivery, I'd go with **SSE (Server-Sent Events)** since it's lightweight and notifications are usually one-way. WebSockets are fine but overkill unless we need strict two-way sync across devices.

*   **GET /api/v1/notifications** 
    *   *Query:* `page`, `limit`, `unread_only`
    *   *Returns:* Array of notification objects and pagination metadata.
*   **PATCH /api/v1/notifications/{id}/read** 
    *   *Returns:* Simple success boolean.

### Stage 2: Database Storage
PostgreSQL is the best fit. The data is highly structured and requires sorting/filtering. 

**Schema basics:**
*   `users` (id, name)
*   `notifications` (id UUID, student_id FK, type ENUM, message, is_read, created_at)

**Handling scale (millions of rows):**
*   **The problems:** Sequential scans kill read speed, old data bloats storage, and bulk inserts lock tables.
*   **The fixes:** 
    1. Add composite indexes.
    2. Partition the table by month (archive anything older than 6 months).
    3. Put Redis in front to cache the top 50 unread notifications for active users.

### Stage 3: Query Optimization
Fetching unread notifications without an index forces a full table scan. 

*   **The fix:** `CREATE INDEX idx_student_unread_date ON notifications (studentID, isRead, createdAt DESC);`
*   This drops the search time from O(N) to O(log N).
*   **Why not index every column?** It ruins write performance. Every INSERT/UPDATE has to update all those indexes, plus it wastes disk space.

*Query for last 7 days:*
```sql
SELECT * FROM notifications 
WHERE type = 'Placement' AND created_at >= NOW() - INTERVAL '7 days';
```

### Stage 4: Fixing DB Overload on Page Load
Hitting the DB every time a user navigates drops the app's performance.

*   **Redis Cache:** Cache the first page of notifications. It's incredibly fast, though handling cache invalidation (when a new alert comes in) is the main tradeoff.
*   **SSE Push:** Fetch once on login, then just push updates to the client. Tradeoff: requires more server memory to hold open connections.
*   **Cursor Pagination:** If they scroll deep, avoid `OFFSET`. Use `id` and `created_at` as cursors so deep queries don't slow down.

### Stage 5: Async Processing (Fixing the Bottleneck)
A synchronous loop that iterates through 50,000 students to save DB records and send emails will take hours. Worse, if the email API times out on student #2000, the whole script crashes.

**The redesign:** Decouple it using a message broker (RabbitMQ/Kafka).
1.  **API:** Gets the "Notify All" request, drops the payload into a message queue, and returns a 200 OK instantly.
2.  **Workers:** Background services pick up the tasks. One worker handles bulk DB inserts. Another handles the email queue.
3.  **Fault Tolerance:** If sending an email fails, that specific task just goes into a retry queue (or Dead Letter Queue). The rest of the batch processes fine.

### Stage 6: Priority Inbox Algorithm
To maintain a "Top 10" list based on weight (Placement=3, Result=2, Event=1) and recency, we don't sort the entire history.

*   **The approach:** Use a Min-Heap of size 10.
*   As notifications come in, calculate their priority score.
*   If the heap has 10 items, compare the new notification to the root (the lowest priority item in the heap). If the new one is higher, pop the root and push the new one.
*   **Performance:** Maintaining a heap of size K takes O(log K). Since K is hardcoded to 10, the time complexity is essentially O(1). Highly efficient for streaming data.