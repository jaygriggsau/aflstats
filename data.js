/*
 * AFL 2024 season — illustrative dataset.
 * Win/loss records and ladder order approximate the real 2024 home-and-away
 * season; points-for/against are representative figures chosen so every derived
 * stat (percentage, ladder points) stays internally consistent.
 *
 * Ladder points = wins*4 + draws*2.  Percentage = pointsFor / pointsAgainst * 100.
 * Both are computed at runtime, not stored, so the data can't contradict itself.
 */
const AFL_SEASON = "2024";

const TEAMS = [
  { name: "Sydney Swans",      abbr: "SYD", w: 17, l: 5,  d: 1, pf: 2240, pa: 1700 },
  { name: "Port Adelaide",     abbr: "PA",  w: 17, l: 6,  d: 0, pf: 2100, pa: 1750 },
  { name: "Geelong Cats",      abbr: "GEE", w: 16, l: 7,  d: 0, pf: 2180, pa: 1680 },
  { name: "Brisbane Lions",    abbr: "BL",  w: 14, l: 8,  d: 1, pf: 2200, pa: 1760 },
  { name: "GWS Giants",        abbr: "GWS", w: 14, l: 9,  d: 0, pf: 2120, pa: 1740 },
  { name: "Western Bulldogs",  abbr: "WB",  w: 14, l: 9,  d: 0, pf: 2160, pa: 1800 },
  { name: "Hawthorn",          abbr: "HAW", w: 13, l: 9,  d: 1, pf: 2050, pa: 1720 },
  { name: "Carlton",           abbr: "CAR", w: 13, l: 10, d: 0, pf: 2000, pa: 1800 },
  { name: "Fremantle",         abbr: "FRE", w: 13, l: 10, d: 0, pf: 1900, pa: 1740 },
  { name: "Collingwood",       abbr: "COL", w: 12, l: 11, d: 0, pf: 1850, pa: 1820 },
  { name: "Gold Coast Suns",   abbr: "GC",  w: 11, l: 12, d: 0, pf: 1980, pa: 1900 },
  { name: "Adelaide Crows",    abbr: "ADE", w: 11, l: 12, d: 0, pf: 2010, pa: 1980 },
  { name: "Essendon",          abbr: "ESS", w: 10, l: 12, d: 1, pf: 1880, pa: 1900 },
  { name: "St Kilda",          abbr: "STK", w: 10, l: 13, d: 0, pf: 1700, pa: 1820 },
  { name: "Melbourne",         abbr: "MEL", w: 9,  l: 14, d: 0, pf: 1760, pa: 1880 },
  { name: "Richmond",          abbr: "RIC", w: 6,  l: 17, d: 0, pf: 1640, pa: 2200 },
  { name: "West Coast Eagles", abbr: "WCE", w: 5,  l: 18, d: 0, pf: 1600, pa: 2300 },
  { name: "North Melbourne",   abbr: "NM",  w: 3,  l: 20, d: 0, pf: 1560, pa: 2400 },
];

const GOALKICKERS = [
  { player: "Jesse Hogan",     team: "GWS Giants",       goals: 71 },
  { player: "Charlie Curnow",  team: "Carlton",          goals: 68 },
  { player: "Ben King",        team: "Gold Coast Suns",  goals: 64 },
  { player: "Jeremy Cameron",  team: "Geelong Cats",     goals: 63 },
  { player: "Aaron Naughton",  team: "Western Bulldogs", goals: 60 },
  { player: "Nick Larkey",     team: "North Melbourne",  goals: 58 },
  { player: "Joe Daniher",     team: "Brisbane Lions",   goals: 53 },
  { player: "Taylor Walker",   team: "Adelaide Crows",   goals: 52 },
  { player: "Bayley Fritsch",  team: "Melbourne",        goals: 48 },
  { player: "Toby Greene",     team: "GWS Giants",       goals: 45 },
];

const PREMIER = "Brisbane Lions"; // 2024 Grand Final winners (def. Sydney Swans)

/* ---- derived helpers ---- */
function gamesPlayed(t)  { return t.w + t.l + t.d; }
function points(t)       { return t.w * 4 + t.d * 2; }
function percentage(t)   { return (t.pf / t.pa) * 100; }

/** Ladder sorted by points, then percentage. */
function ladder() {
  return [...TEAMS].sort((a, b) =>
    points(b) - points(a) || percentage(b) - percentage(a)
  );
}
