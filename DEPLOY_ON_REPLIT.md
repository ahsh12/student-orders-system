# Deployment Instructions (Replit)

This project is configured to run on Replit with a persistent SQLite database.

## Steps to Deploy

1. **Create a new Repl**
   - Go to [Replit](https://replit.com)
   - Click "Create Repl"
   - Choose **Node.js** template
   - Give it a name (e.g., "StudentOrders")

2. **Upload Files**
   - Drag and drop all files from this project into the Repl file explorer.
   - Ensure the structure is:
     ```
     /public
       - index.html
       - login.html
       - page2.html
       - page3.html
       - styles.css
       - *.js
     - package.json
     - server.js
     - database.js
     ```

3. **Install Dependencies**
   - In the "Shell" tab (right side), run:
     ```bash
     npm install
     ```

4. **Run the Server**
   - Click the big green **Run** button at the top.
   - The server should start on port 3000.
   - A "Webview" window will open showing your app.

## Login Credentials

- **Username**: `admin`
- **Password**: `admin123`

## Sharing

- Copy the URL from the Webview address bar.
- Share this URL with your co-worker.
- They will see the Login page.

## Database Management

- The database is stored in `orders.db` in the root folder.
- To download it: Click the three dots on `orders.db` in the file explorer -> Download.
- To reset password: You can delete `orders.db` to reset everything, or use a SQLite browser to edit the `users` table (requires generating a new bcrypt hash).

## Backup

- Regularly download `orders.db` to your local computer as a backup.
