import { DatabaseSync } from "node:sqlite";

// Baza w pamięci: tabele i dane powstają przy każdym starcie serwera.
export function createDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");

  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL);
    CREATE TABLE tokens (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id));
    CREATE TABLE items (id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL);
    CREATE TABLE auctions (
      id INTEGER PRIMARY KEY,
      item_id INTEGER NOT NULL REFERENCES items(id),
      seller_id INTEGER NOT NULL REFERENCES users(id),
      current_price INTEGER NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE bids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      auction_id INTEGER NOT NULL REFERENCES auctions(id),
      bidder_id INTEGER NOT NULL REFERENCES users(id),
      amount INTEGER NOT NULL
    );

    INSERT INTO users VALUES
      (1, 'Maria', '12 Oak Street, Boston'),
      (2, 'Nina', '88 Hill Avenue, Austin'),
      (3, 'Oscar', '3 Pine Lane, Seattle');

    INSERT INTO tokens VALUES ('maria-token', 1), ('nina-token', 2);

    INSERT INTO items VALUES
      (1, 'Vintage typewriter', 'Underwood No. 5 from 1928, restored, with the original wooden case.'),
      (2, 'Mechanical watch', 'Hand-wound watch from 1962 with a steel case.');

    INSERT INTO auctions VALUES
      (1, 1, 1, 120, 'OPEN'),
      (2, 2, 1, 340, 'OPEN');

    INSERT INTO bids (auction_id, bidder_id, amount) VALUES
      (1, 2, 100),
      (1, 3, 120);
  `);

  return db;
}
