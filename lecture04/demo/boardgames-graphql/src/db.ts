import { DatabaseSync } from "node:sqlite";

// Baza w pamięci: tabele i dane powstają przy każdym starcie serwera.
export function createDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");

  db.exec(`
    CREATE TABLE publishers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, country TEXT NOT NULL);
    CREATE TABLE games (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      year INTEGER NOT NULL,
      min_players INTEGER NOT NULL,
      max_players INTEGER NOT NULL,
      publisher_id INTEGER NOT NULL REFERENCES publishers(id)
    );
    CREATE TABLE copies (id INTEGER PRIMARY KEY, game_id INTEGER NOT NULL REFERENCES games(id));
    CREATE TABLE loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      copy_id INTEGER NOT NULL REFERENCES copies(id),
      borrower TEXT NOT NULL
    );
    CREATE TABLE reviews (
      id INTEGER PRIMARY KEY,
      game_id INTEGER NOT NULL REFERENCES games(id),
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL
    );

    INSERT INTO publishers VALUES
      (1, 'Kosmos', 'Germany'),
      (2, 'Z-Man Games', 'USA'),
      (3, 'Days of Wonder', 'France'),
      (4, 'Stonemaier Games', 'USA');

    INSERT INTO games VALUES
      (1, 'Catan', 1995, 3, 4, 1),
      (2, 'Pandemic', 2008, 2, 4, 2),
      (3, 'Ticket to Ride', 2004, 2, 5, 3),
      (4, 'Wingspan', 2019, 1, 5, 4),
      (5, 'Scythe', 2016, 1, 5, 4),
      (6, 'Carcassonne', 2000, 2, 5, 2),
      (7, 'Small World', 2009, 2, 5, 3),
      (8, 'Azul', 2017, 2, 4, 1);

    -- Catan ma dwa egzemplarze, reszta gier po jednym.
    INSERT INTO copies VALUES (1, 1), (2, 1), (3, 2), (4, 3), (5, 4), (6, 5), (7, 6), (8, 7), (9, 8);

    -- Egzemplarz 1 (Catan) jest od początku wypożyczony.
    INSERT INTO loans (copy_id, borrower) VALUES (1, 'alice');

    INSERT INTO reviews VALUES
      (1, 1, 5, 'A classic.'),
      (2, 1, 4, 'Trading is fun.'),
      (3, 2, 5, 'We win or lose together.'),
      (4, 3, 4, 'Easy to teach.'),
      (5, 4, 5, 'Beautiful components.'),
      (6, 4, 4, 'Relaxing.'),
      (7, 5, 5, 'Deep strategy.'),
      (8, 6, 3, 'Fine, a bit random.'),
      (9, 7, 4, 'Chaotic and funny.'),
      (10, 8, 5, 'Simple and elegant.'),
      (11, 8, 4, 'Great with two players.');
  `);

  return db;
}
