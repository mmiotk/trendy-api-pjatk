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
      (2, 'Tom', '5 River Road, Denver'),
      (3, 'Nina', '88 Hill Avenue, Austin'),
      (4, 'Oscar', '3 Pine Lane, Seattle');

    INSERT INTO tokens VALUES ('maria-token', 1), ('tom-token', 2), ('nina-token', 3);

    INSERT INTO items VALUES
      (1, 'Vintage typewriter', 'Underwood No. 5 from 1928, restored, with a new ribbon and the original wooden case.'),
      (2, 'Mechanical watch', 'Hand-wound watch from 1962 with a steel case, serviced last year.'),
      (3, 'Oak writing desk', 'Solid oak desk with three drawers and a green leather top, 120 cm wide.'),
      (4, 'First edition atlas', 'World atlas printed in 1954, 64 colour maps, light wear on the spine.'),
      (5, 'Film camera', '35 mm rangefinder camera with a 50 mm lens and a leather strap.'),
      (6, 'Brass telescope', 'Three-draw brass telescope from the 1900s with a wooden tripod.');

    INSERT INTO auctions VALUES
      (1, 1, 1, 120, 'OPEN'),
      (2, 2, 1, 340, 'OPEN'),
      (3, 3, 2, 90, 'OPEN'),
      (4, 4, 2, 500, 'OPEN'),
      (5, 5, 1, 75, 'OPEN'),
      (6, 6, 2, 210, 'OPEN');

    INSERT INTO bids (auction_id, bidder_id, amount) VALUES
      (1, 3, 100), (1, 4, 110), (1, 3, 120),
      (2, 4, 320), (2, 3, 340),
      (3, 3, 90);
  `);

  return db;
}
