import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import initSqlJs, { Database } from 'sql.js';

// Minimal Chinook schema + sample data for query testing
const CHINOOK_DDL = `
CREATE TABLE Genre (
  GenreId   INTEGER PRIMARY KEY,
  Name      TEXT
);
CREATE TABLE MediaType (
  MediaTypeId INTEGER PRIMARY KEY,
  Name        TEXT
);
CREATE TABLE Artist (
  ArtistId INTEGER PRIMARY KEY,
  Name     TEXT
);
CREATE TABLE Album (
  AlbumId  INTEGER PRIMARY KEY,
  Title    TEXT,
  ArtistId INTEGER REFERENCES Artist(ArtistId)
);
CREATE TABLE Track (
  TrackId     INTEGER PRIMARY KEY,
  Name        TEXT,
  AlbumId     INTEGER REFERENCES Album(AlbumId),
  MediaTypeId INTEGER REFERENCES MediaType(MediaTypeId),
  GenreId     INTEGER REFERENCES Genre(GenreId),
  Composer    TEXT,
  Milliseconds INTEGER,
  Bytes       INTEGER,
  UnitPrice   REAL
);
CREATE TABLE Employee (
  EmployeeId INTEGER PRIMARY KEY,
  LastName   TEXT,
  FirstName  TEXT,
  Title      TEXT,
  ReportsTo  INTEGER REFERENCES Employee(EmployeeId),
  City       TEXT,
  Country    TEXT,
  Email      TEXT
);
CREATE TABLE Customer (
  CustomerId   INTEGER PRIMARY KEY,
  FirstName    TEXT,
  LastName     TEXT,
  Company      TEXT,
  City         TEXT,
  Country      TEXT,
  Email        TEXT,
  SupportRepId INTEGER REFERENCES Employee(EmployeeId)
);
CREATE TABLE Invoice (
  InvoiceId      INTEGER PRIMARY KEY,
  CustomerId     INTEGER REFERENCES Customer(CustomerId),
  InvoiceDate    TEXT,
  BillingCity    TEXT,
  BillingCountry TEXT,
  Total          REAL
);
CREATE TABLE InvoiceLine (
  InvoiceLineId INTEGER PRIMARY KEY,
  InvoiceId     INTEGER REFERENCES Invoice(InvoiceId),
  TrackId       INTEGER REFERENCES Track(TrackId),
  UnitPrice     REAL,
  Quantity      INTEGER
);
CREATE TABLE Playlist (
  PlaylistId INTEGER PRIMARY KEY,
  Name       TEXT
);
CREATE TABLE PlaylistTrack (
  PlaylistId INTEGER REFERENCES Playlist(PlaylistId),
  TrackId    INTEGER REFERENCES Track(TrackId),
  PRIMARY KEY (PlaylistId, TrackId)
);
`;

const CHINOOK_DATA = `
INSERT INTO Genre VALUES (1,'Rock'),(2,'Jazz'),(3,'Metal'),(4,'Alternative & Punk'),(5,'Classical');
INSERT INTO MediaType VALUES (1,'MPEG audio file'),(2,'Protected AAC audio file'),(3,'AAC audio file');
INSERT INTO Artist VALUES
  (1,'AC/DC'),(2,'Accept'),(3,'Aerosmith'),(4,'Alanis Morissette'),
  (5,'Alice In Chains'),(6,'Miles Davis'),(7,'Bach, Johann Sebastian');
INSERT INTO Album VALUES
  (1,'For Those About To Rock We Salute You',1),
  (2,'Balls to the Wall',2),
  (3,'Restless and Wild',2),
  (4,'Let There Be Rock',1),
  (5,'Big Ones',3),
  (6,'Jagged Little Pill',4),
  (7,'Facelift',5),
  (8,'Kind of Blue',6),
  (9,'The Goldberg Variations',7);
INSERT INTO Track VALUES
  (1,'For Those About To Rock (We Salute You)',1,1,1,'Angus Young',343719,11170334,0.99),
  (2,'Balls to the Wall',2,2,1,NULL,342562,5510424,0.99),
  (3,'Fast As a Shark',3,2,1,'F. Baltes',230619,3990994,0.99),
  (4,'Restless and Wild',3,2,1,'F. Baltes',252051,4331779,0.99),
  (5,'Princess of the Dawn',3,2,1,'Deaffy',375418,6290521,0.99),
  (6,'Put The Finger On You',1,1,1,'Angus Young',205662,6713451,0.99),
  (7,'Let There Be Rock',4,1,1,'Angus Young',366654,12021261,0.99),
  (8,'Walk On Water',5,1,1,'Steven Tyler',295680,9719579,0.99),
  (9,'Love In An Elevator',5,1,1,'Steven Tyler',321828,10552051,0.99),
  (10,'Rag Doll',5,1,1,'Steven Tyler',264698,8676076,0.99),
  (11,'You Oughta Know',6,1,4,'Alanis Morissette',249234,8196916,0.99),
  (12,'Perfect',6,1,4,'Alanis Morissette',188133,6145404,0.99),
  (13,'Hand In My Pocket',6,1,4,'Alanis Morissette',221570,7200987,0.99),
  (14,'Would?',7,1,1,'Jerry Cantrell',193792,6454937,0.99),
  (15,'Them Bones',7,1,1,'Jerry Cantrell',148273,4921448,0.99),
  (16,'So What',8,1,2,'Miles Davis',548784,17191596,0.99),
  (17,'Freddie Freeloader',8,1,2,'Miles Davis',569769,18065859,0.99),
  (18,'Aria',9,3,5,'Johann Sebastian Bach',306720,9578140,0.99);
INSERT INTO Employee VALUES
  (1,'Adams','Andrew','General Manager',NULL,'Edmonton','Canada','andrew@chinookcorp.com'),
  (2,'Edwards','Nancy','Sales Manager',1,'Calgary','Canada','nancy@chinookcorp.com'),
  (3,'Peacock','Jane','Sales Support Agent',2,'Calgary','Canada','jane@chinookcorp.com'),
  (4,'Park','Margaret','Sales Support Agent',2,'Calgary','Canada','margaret@chinookcorp.com');
INSERT INTO Customer VALUES
  (1,'Luís','Gonçalves','Embraer','São José dos Campos','Brazil','luisg@embraer.com.br',3),
  (2,'Leonie','Köhler',NULL,'Stuttgart','Germany','leonekohler@surfeu.de',3),
  (3,'François','Tremblay',NULL,'Montréal','Canada','ftremblay@gmail.com',3),
  (4,'Bjørn','Hansen',NULL,'Oslo','Norway','bjorn.hansen@yahoo.no',4),
  (5,'František','Wichterlová','JetBrains','Prague','Czech Republic','frantisekw@jetbrains.com',4),
  (6,'Helena','Holý',NULL,'Prague','Czech Republic','hholy@gmail.com',3),
  (7,'Astrid','Gruber',NULL,'Vienne','Austria','astrid.gruber@apple.at',3),
  (8,'Daan','Peeters',NULL,'Brussels','Belgium','daan_peeters@apple.be',4),
  (9,'Kara','Nielsen',NULL,'Copenhagen','Denmark','kara.nielsen@jubii.dk',4),
  (10,'Eduardo','Martins','Woodstock Discos','São Paulo','Brazil','eduardo@woodstock.com.br',4);
INSERT INTO Invoice VALUES
  (1,2,'2009-01-01','Stuttgart','Germany',1.98),
  (2,4,'2009-01-02','Oslo','Norway',3.96),
  (3,8,'2009-01-03','Brussels','Belgium',5.94),
  (4,14,'2009-01-06','Edinburgh','United Kingdom',8.91),
  (5,23,'2009-01-11','Boston','USA',13.86),
  (6,37,'2009-02-11','Yellowknife','Canada',0.99),
  (7,38,'2009-02-20','Berlin','Germany',1.98),
  (8,40,'2009-02-25','Delhi','India',1.98),
  (9,6,'2009-03-04','Prague','Czech Republic',3.96),
  (10,7,'2009-03-04','Vienne','Austria',5.94),
  (11,1,'2009-03-11','São José dos Campos','Brazil',0.99),
  (12,2,'2009-06-09','Stuttgart','Germany',13.86),
  (13,3,'2009-11-13','Montréal','Canada',8.91),
  (14,4,'2010-01-23','Oslo','Norway',21.86),
  (15,5,'2010-03-11','Prague','Czech Republic',3.96);
INSERT INTO InvoiceLine VALUES
  (1,1,2,0.99,1),(2,1,4,0.99,1),
  (3,2,6,0.99,1),(4,2,8,0.99,1),(5,2,10,0.99,1),(6,2,12,0.99,1),
  (7,3,16,0.99,1),(8,3,17,0.99,1),(9,3,1,0.99,1),(10,3,3,0.99,1),(11,3,5,0.99,1),(12,3,7,0.99,1),
  (13,4,11,0.99,1),(14,4,13,0.99,1),(15,4,15,0.99,1),(16,4,2,0.99,1),(17,4,4,0.99,1),(18,4,6,0.99,1),(19,4,8,0.99,1),(20,4,10,0.99,1),(21,4,12,0.99,1),
  (22,9,11,0.99,1),(23,9,13,0.99,1),(24,9,15,0.99,1),(25,9,17,0.99,1),
  (26,11,18,0.99,1),
  (27,12,1,0.99,1),(28,12,3,0.99,1),(29,12,5,0.99,1),(30,12,7,0.99,1),(31,12,9,0.99,1),(32,12,11,0.99,1),(33,12,13,0.99,1),(34,12,15,0.99,1),(35,12,17,0.99,1),(36,12,2,0.99,1),(37,12,4,0.99,1),(38,12,6,0.99,1),(39,12,8,0.99,1),(40,12,10,0.99,1),
  (41,13,1,0.99,1),(42,13,3,0.99,1),(43,13,5,0.99,1),(44,13,7,0.99,1),(45,13,9,0.99,1),(46,13,11,0.99,1),(47,13,13,0.99,1),(48,13,15,0.99,1),(49,13,17,0.99,1),
  (50,14,1,0.99,1),(51,14,3,0.99,1),(52,14,5,0.99,1),(53,14,7,0.99,1),(54,14,9,0.99,1),(55,14,11,0.99,1),(56,14,13,0.99,1),(57,14,15,0.99,1),(58,14,17,0.99,1),(59,14,2,0.99,1),(60,14,4,0.99,1),(61,14,6,0.99,1),(62,14,8,0.99,1),(63,14,10,0.99,1),(64,14,12,0.99,1),(65,14,14,0.99,1),(66,14,16,0.99,1),(67,14,18,0.99,1),(68,14,16,0.99,1),(69,14,18,0.99,1),(70,14,17,0.99,1),(71,14,1,0.99,1),(72,14,2,0.99,1);
INSERT INTO Playlist VALUES (1,'Music'),(2,'Movies'),(3,'TV Shows'),(4,'Audiobooks'),(5,'90s Music');
INSERT INTO PlaylistTrack VALUES
  (1,1),(1,2),(1,3),(1,4),(1,5),(1,6),(1,7),(1,8),(1,9),(1,10),
  (1,11),(1,12),(1,13),(1,14),(1,15),(1,16),(1,17),(1,18),
  (5,11),(5,12),(5,13);
`;

let db: Database;

beforeAll(async () => {
  const SQL = await initSqlJs();
  db = new SQL.Database();
  db.exec(CHINOOK_DDL);
  db.exec(CHINOOK_DATA);
});

afterAll(() => {
  db.close();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function rows(sql: string): any[][] {
  const res = db.exec(sql);
  return res.length ? res[0].values : [];
}

function cols(sql: string): string[] {
  const res = db.exec(sql);
  return res.length ? res[0].columns : [];
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Chinook – basic selects', () => {
  it('lists all genres', () => {
    const result = rows('SELECT Name FROM Genre ORDER BY GenreId');
    expect(result).toEqual([['Rock'], ['Jazz'], ['Metal'], ['Alternative & Punk'], ['Classical']]);
  });

  it('counts artists', () => {
    const [[count]] = rows('SELECT COUNT(*) FROM Artist');
    expect(count).toBe(7);
  });

  it('returns correct columns for Track', () => {
    const columns = cols('SELECT * FROM Track LIMIT 1');
    expect(columns).toContain('TrackId');
    expect(columns).toContain('Name');
    expect(columns).toContain('UnitPrice');
  });

  it('filters tracks by genre (Rock = 1)', () => {
    const result = rows('SELECT COUNT(*) FROM Track WHERE GenreId = 1');
    expect(result[0][0]).toBeGreaterThan(0);
  });

  it('finds tracks with no composer (NULL)', () => {
    const result = rows('SELECT Name FROM Track WHERE Composer IS NULL');
    expect(result.length).toBeGreaterThan(0);
    expect(result.map((r) => r[0])).toContain('Balls to the Wall');
  });
});

describe('Chinook – joins', () => {
  it('joins Album → Artist', () => {
    const result = rows(`
      SELECT al.Title, ar.Name
      FROM Album al
      JOIN Artist ar ON ar.ArtistId = al.ArtistId
      WHERE ar.Name = 'AC/DC'
      ORDER BY al.AlbumId
    `);
    expect(result.length).toBe(2);
    expect(result[0][0]).toBe('For Those About To Rock We Salute You');
  });

  it('joins Track → Album → Artist', () => {
    const result = rows(`
      SELECT t.Name, al.Title, ar.Name
      FROM Track t
      JOIN Album al ON al.AlbumId = t.AlbumId
      JOIN Artist ar ON ar.ArtistId = al.ArtistId
      WHERE ar.Name = 'Alanis Morissette'
      ORDER BY t.TrackId
    `);
    expect(result.length).toBe(3);
    expect(result.map((r) => r[0])).toContain('You Oughta Know');
  });

  it('joins Track → Genre', () => {
    const result = rows(`
      SELECT t.Name, g.Name AS Genre
      FROM Track t
      JOIN Genre g ON g.GenreId = t.GenreId
      WHERE g.Name = 'Jazz'
    `);
    expect(result.length).toBe(2);
  });

  it('joins Invoice → Customer', () => {
    const result = rows(`
      SELECT c.FirstName || ' ' || c.LastName AS Customer, i.Total
      FROM Invoice i
      JOIN Customer c ON c.CustomerId = i.CustomerId
      WHERE i.Total > 10
      ORDER BY i.Total DESC
    `);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0][1]).toBeGreaterThan(10);
  });

  it('joins InvoiceLine → Track → Album', () => {
    const result = rows(`
      SELECT il.InvoiceLineId, t.Name, al.Title
      FROM InvoiceLine il
      JOIN Track t ON t.TrackId = il.TrackId
      JOIN Album al ON al.AlbumId = t.AlbumId
      ORDER BY il.InvoiceLineId
      LIMIT 5
    `);
    expect(result.length).toBe(5);
    expect(result[0].length).toBe(3);
  });

  it('left joins Customer → Invoice (all customers including those with no invoice)', () => {
    const result = rows(`
      SELECT c.CustomerId, COUNT(i.InvoiceId) AS NumInvoices
      FROM Customer c
      LEFT JOIN Invoice i ON i.CustomerId = c.CustomerId
      GROUP BY c.CustomerId
      ORDER BY c.CustomerId
    `);
    expect(result.length).toBe(10);
  });

  it('joins Playlist → PlaylistTrack → Track', () => {
    const result = rows(`
      SELECT p.Name AS Playlist, COUNT(pt.TrackId) AS TrackCount
      FROM Playlist p
      JOIN PlaylistTrack pt ON pt.PlaylistId = p.PlaylistId
      JOIN Track t ON t.TrackId = pt.TrackId
      GROUP BY p.PlaylistId
      ORDER BY p.PlaylistId
    `);
    expect(result.length).toBeGreaterThan(0);
    const musicPlaylist = result.find((r) => r[0] === 'Music');
    expect(musicPlaylist).toBeDefined();
    expect(musicPlaylist![1]).toBe(18);
  });
});

describe('Chinook – aggregations', () => {
  it('counts tracks per album', () => {
    const result = rows(`
      SELECT AlbumId, COUNT(*) AS TrackCount
      FROM Track
      GROUP BY AlbumId
      ORDER BY AlbumId
    `);
    expect(result.length).toBe(9);
    // Album 3 (Restless and Wild) has 3 tracks
    const album3 = result.find((r) => r[0] === 3);
    expect(album3![1]).toBe(3);
  });

  it('sums total sales per customer', () => {
    const result = rows(`
      SELECT CustomerId, ROUND(SUM(Total), 2) AS TotalSpent
      FROM Invoice
      GROUP BY CustomerId
      ORDER BY TotalSpent DESC
      LIMIT 3
    `);
    expect(result.length).toBe(3);
    expect(result[0][1]).toBeGreaterThanOrEqual(result[1][1]);
  });

  it('average track duration per genre', () => {
    const result = rows(`
      SELECT g.Name, ROUND(AVG(t.Milliseconds) / 1000.0, 1) AS AvgSeconds
      FROM Track t
      JOIN Genre g ON g.GenreId = t.GenreId
      GROUP BY t.GenreId
      ORDER BY g.Name
    `);
    expect(result.length).toBeGreaterThan(0);
    result.forEach(([, avgSec]) => expect(avgSec).toBeGreaterThan(0));
  });

  it('finds the longest track', () => {
    const result = rows(`
      SELECT Name, Milliseconds
      FROM Track
      ORDER BY Milliseconds DESC
      LIMIT 1
    `);
    expect(result.length).toBe(1);
    expect(result[0][0]).toBe('Freddie Freeloader');
  });

  it('counts albums per artist, filtered to artists with >1 album', () => {
    const result = rows(`
      SELECT ar.Name, COUNT(al.AlbumId) AS Albums
      FROM Artist ar
      JOIN Album al ON al.ArtistId = ar.ArtistId
      GROUP BY ar.ArtistId
      HAVING Albums > 1
      ORDER BY ar.Name
    `);
    // AC/DC has 2 albums, Accept has 2 albums, Aerosmith has 1 → only AC/DC & Accept
    expect(result.length).toBe(2);
    expect(result.map((r) => r[0])).toContain('AC/DC');
    expect(result.map((r) => r[0])).toContain('Accept');
  });

  it('total revenue per billing country', () => {
    const result = rows(`
      SELECT BillingCountry, ROUND(SUM(Total), 2) AS Revenue
      FROM Invoice
      GROUP BY BillingCountry
      ORDER BY Revenue DESC
    `);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0][1]).toBeGreaterThan(0);
  });
});

describe('Chinook – subqueries', () => {
  it('finds tracks on the "Music" playlist via subquery', () => {
    const result = rows(`
      SELECT Name FROM Track
      WHERE TrackId IN (
        SELECT TrackId FROM PlaylistTrack
        WHERE PlaylistId = (SELECT PlaylistId FROM Playlist WHERE Name = 'Music')
      )
      ORDER BY TrackId
    `);
    expect(result.length).toBe(18);
  });

  it('finds customers who have spent more than the average invoice total', () => {
    const result = rows(`
      SELECT DISTINCT c.FirstName || ' ' || c.LastName AS Customer
      FROM Customer c
      JOIN Invoice i ON i.CustomerId = c.CustomerId
      WHERE i.Total > (SELECT AVG(Total) FROM Invoice)
      ORDER BY Customer
    `);
    expect(result.length).toBeGreaterThan(0);
  });

  it('finds artists with at least one track longer than 5 minutes', () => {
    const result = rows(`
      SELECT DISTINCT ar.Name
      FROM Artist ar
      WHERE ar.ArtistId IN (
        SELECT al.ArtistId FROM Album al
        JOIN Track t ON t.AlbumId = al.AlbumId
        WHERE t.Milliseconds > 300000
      )
      ORDER BY ar.Name
    `);
    expect(result.length).toBeGreaterThan(0);
    expect(result.map((r) => r[0])).toContain('Miles Davis');
  });
});

describe('Chinook – self-join & hierarchy', () => {
  it('lists employees and their manager', () => {
    const result = rows(`
      SELECT e.FirstName || ' ' || e.LastName AS Employee,
             m.FirstName || ' ' || m.LastName AS Manager
      FROM Employee e
      LEFT JOIN Employee m ON m.EmployeeId = e.ReportsTo
      ORDER BY e.EmployeeId
    `);
    expect(result.length).toBe(4);
    // Andrew Adams has no manager
    expect(result[0][1]).toBeNull();
    // Nancy Edwards reports to Andrew Adams
    expect(result[1][1]).toBe('Andrew Adams');
  });

  it('counts direct reports per manager', () => {
    const result = rows(`
      SELECT m.FirstName || ' ' || m.LastName AS Manager,
             COUNT(e.EmployeeId) AS DirectReports
      FROM Employee e
      JOIN Employee m ON m.EmployeeId = e.ReportsTo
      GROUP BY m.EmployeeId
      ORDER BY DirectReports DESC
    `);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0][1]).toBeGreaterThanOrEqual(2);
  });
});

describe('Chinook – string & date operations', () => {
  it('searches track names case-insensitively', () => {
    const result = rows(`
      SELECT Name FROM Track
      WHERE LOWER(Name) LIKE '%rock%'
      ORDER BY Name
    `);
    expect(result.length).toBeGreaterThan(0);
    result.forEach(([name]) => expect(name.toLowerCase()).toContain('rock'));
  });

  it('extracts year from InvoiceDate', () => {
    const result = rows(`
      SELECT DISTINCT SUBSTR(InvoiceDate, 1, 4) AS Year
      FROM Invoice
      ORDER BY Year
    `);
    expect(result.map((r) => r[0])).toContain('2009');
  });

  it('concatenates customer full name', () => {
    const result = rows(`
      SELECT FirstName || ' ' || LastName AS FullName
      FROM Customer
      ORDER BY CustomerId
      LIMIT 1
    `);
    expect(result[0][0]).toBe('Luís Gonçalves');
  });
});

describe('Chinook – window / ranking (SQLite 3.25+)', () => {
  it('ranks tracks by duration within each genre', () => {
    const result = rows(`
      SELECT Name, GenreId, Milliseconds,
             RANK() OVER (PARTITION BY GenreId ORDER BY Milliseconds DESC) AS Rnk
      FROM Track
      ORDER BY GenreId, Rnk
    `);
    expect(result.length).toBeGreaterThan(0);
    // First row of each genre partition should have rank 1
    const rank1Rows = result.filter((r) => r[3] === 1);
    expect(rank1Rows.length).toBeGreaterThan(0);
  });

  it('computes running total of invoice amounts', () => {
    const result = rows(`
      SELECT InvoiceId, Total,
             ROUND(SUM(Total) OVER (ORDER BY InvoiceId), 2) AS RunningTotal
      FROM Invoice
      ORDER BY InvoiceId
    `);
    expect(result.length).toBeGreaterThan(0);
    // Running total should be non-decreasing
    for (let i = 1; i < result.length; i++) {
      expect(result[i][2]).toBeGreaterThanOrEqual(result[i - 1][2]);
    }
  });
});

describe('Chinook – CTEs', () => {
  it('uses a CTE to find top-selling tracks', () => {
    const result = rows(`
      WITH TrackSales AS (
        SELECT TrackId, SUM(Quantity) AS TotalQty
        FROM InvoiceLine
        GROUP BY TrackId
      )
      SELECT t.Name, ts.TotalQty
      FROM Track t
      JOIN TrackSales ts ON ts.TrackId = t.TrackId
      ORDER BY ts.TotalQty DESC
      LIMIT 5
    `);
    expect(result.length).toBe(5);
    expect(result[0][1]).toBeGreaterThanOrEqual(result[1][1]);
  });

  it('uses a CTE to compute customer lifetime value', () => {
    const result = rows(`
      WITH CustomerLTV AS (
        SELECT CustomerId, ROUND(SUM(Total), 2) AS LTV
        FROM Invoice
        GROUP BY CustomerId
      )
      SELECT c.FirstName || ' ' || c.LastName AS Customer, ltv.LTV
      FROM Customer c
      JOIN CustomerLTV ltv ON ltv.CustomerId = c.CustomerId
      ORDER BY ltv.LTV DESC
    `);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0][1]).toBeGreaterThan(0);
  });
});
