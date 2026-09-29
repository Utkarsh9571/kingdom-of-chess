const { io } = require('socket.io-client');

const BASE_URL = 'http://localhost:4000/api/v1';
const SOCKET_URL = 'http://localhost:4000';

async function loginUser(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${await res.text()}`);
  }
  const setCookie = res.headers.get('set-cookie');
  let cookieHeader = null;
  if (setCookie) {
    const match = setCookie.match(/jwt=([^;]+)/);
    if (match) cookieHeader = `jwt=${match[1]}`;
  }
  const data = await res.json();
  return { user: data.data.user, cookieHeader };
}

async function getTournaments(cookieHeader) {
  const res = await fetch(`${BASE_URL}/tournaments`, {
    headers: { Cookie: cookieHeader },
  });
  const data = await res.json();
  return data.data;
}

async function joinTournament(tournamentId, cookieHeader) {
  const res = await fetch(`${BASE_URL}/tournaments/${tournamentId}/join`, {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
  });
  return res.json();
}

async function getMatchDetails(matchId, cookieHeader) {
  const res = await fetch(`${BASE_URL}/matches/${matchId}`, {
    headers: { Cookie: cookieHeader },
  });
  const data = await res.json();
  return data.data;
}

async function getMatchMoves(matchId, cookieHeader) {
  const res = await fetch(`${BASE_URL}/matches/${matchId}/moves`, {
    headers: { Cookie: cookieHeader },
  });
  const data = await res.json();
  return data.data;
}

async function run() {
  console.log('=== STEP 1: Authenticating Student 1 and Student 2 ===');
  const student1 = await loginUser('student1@kingdom.com', 'Password123!');
  console.log(`✓ Student 1 logged in: ${student1.user.name} (${student1.user.id})`);

  const student2 = await loginUser('student2@kingdom.com', 'Password123!');
  console.log(`✓ Student 2 logged in: ${student2.user.name} (${student2.user.id})`);

  console.log('\n=== STEP 2: Fetching Open Tournament ===');
  const tournaments = await getTournaments(student1.cookieHeader);
  const tournament = tournaments.find((t) => t.status === 'open' || t.status === 'ongoing');
  if (!tournament) {
    throw new Error('No open/ongoing tournament found! Seed data required.');
  }
  console.log(`✓ Target Tournament: "${tournament.name}" (${tournament.id}, Time Control: ${tournament.timeControl})`);

  // Ensure both enrolled
  await joinTournament(tournament.id, student1.cookieHeader);
  await joinTournament(tournament.id, student2.cookieHeader);
  console.log('✓ Both students enrolled in tournament.');

  console.log('\n=== STEP 3: Connecting Socket.IO Clients via HTTP Cookie ===');
  const socket1 = io(SOCKET_URL, {
    extraHeaders: { Cookie: student1.cookieHeader },
    transports: ['websocket'],
  });
  const socket2 = io(SOCKET_URL, {
    extraHeaders: { Cookie: student2.cookieHeader },
    transports: ['websocket'],
  });

  await Promise.all([
    new Promise((resolve) => socket1.on('connect', resolve)),
    new Promise((resolve) => socket2.on('connect', resolve)),
  ]);
  console.log('✓ Sockets connected and authenticated successfully.');

  console.log('\n=== STEP 4: Entering Matchmaking Queue & Auto-Pairing ===');
  const matchPromise = new Promise((resolve) => {
    let matched1 = null;
    let matched2 = null;

    socket1.on('queue:matched', (data) => {
      matched1 = data;
      console.log(`  [Socket 1] queue:matched received! matchId: ${data.matchId}, color: ${data.color}`);
      if (matched1 && matched2) resolve({ s1: matched1, s2: matched2 });
    });

    socket2.on('queue:matched', (data) => {
      matched2 = data;
      console.log(`  [Socket 2] queue:matched received! matchId: ${data.matchId}, color: ${data.color}`);
      if (matched1 && matched2) resolve({ s1: matched1, s2: matched2 });
    });
  });

  socket1.emit('queue:join', { tournamentId: tournament.id });
  socket2.emit('queue:join', { tournamentId: tournament.id });

  const { s1, s2 } = await matchPromise;
  const matchId = s1.matchId;
  console.log(`✓ Successfully paired! Match ID: ${matchId}`);

  const whiteSocket = s1.color === 'w' ? socket1 : socket2;
  const blackSocket = s1.color === 'b' ? socket1 : socket2;
  const whiteStudent = s1.color === 'w' ? student1 : student2;
  const blackStudent = s1.color === 'b' ? student1 : student2;

  console.log(`  White: ${whiteStudent.user.name}`);
  console.log(`  Black: ${blackStudent.user.name}`);

  console.log('\n=== STEP 5: Joining Match Room ===');
  whiteSocket.emit('match:join', { matchId });
  blackSocket.emit('match:join', { matchId });

  await new Promise((r) => setTimeout(r, 600));

  console.log('\n=== STEP 6: Playing Moves on Server-Authoritative Live Board ===');

  // Move 1: White plays 1. e4
  console.log('--- Move 1 (White: e2 -> e4) ---');
  const move1Promise = new Promise((resolve) => {
    blackSocket.once('match:moved', (data) => {
      console.log(`  ✓ Black socket received move: ${data.move.san}, FEN: ${data.fen}, turn: ${data.activeTurn}`);
      console.log(`    White time: ${data.whiteTimeRemainingMs}ms, Black time: ${data.blackTimeRemainingMs}ms`);
      resolve(data);
    });
  });
  whiteSocket.emit('match:move', { matchId, from: 'e2', to: 'e4' });
  const move1Data = await move1Promise;
  if (!move1Data.fen.includes('4P3')) throw new Error('FEN does not reflect move 1. e4');

  // Move 2: Black plays 1... e5
  console.log('--- Move 2 (Black: e7 -> e5) ---');
  const move2Promise = new Promise((resolve) => {
    whiteSocket.once('match:moved', (data) => {
      console.log(`  ✓ White socket received move: ${data.move.san}, FEN: ${data.fen}, turn: ${data.activeTurn}`);
      resolve(data);
    });
  });
  blackSocket.emit('match:move', { matchId, from: 'e7', to: 'e5' });
  const move2Data = await move2Promise;
  if (!move2Data.fen.includes('4p3')) throw new Error('FEN does not reflect move 1... e5');

  // Move 3: White plays 2. Nf3
  console.log('--- Move 3 (White: g1 -> f3) ---');
  const move3Promise = new Promise((resolve) => {
    blackSocket.once('match:moved', resolve);
  });
  whiteSocket.emit('match:move', { matchId, from: 'g1', to: 'f3' });
  await move3Promise;

  // Move 4: Black plays 2... Nc6
  console.log('--- Move 4 (Black: b8 -> c6) ---');
  const move4Promise = new Promise((resolve) => {
    whiteSocket.once('match:moved', resolve);
  });
  blackSocket.emit('match:move', { matchId, from: 'b8', to: 'c6' });
  await move4Promise;

  console.log('\n=== STEP 7: Testing Illegal Move & Out-of-Turn Rejections ===');
  const illegalMovePromise = new Promise((resolve) => {
    blackSocket.once('match:error', (err) => {
      console.log(`  ✓ Black attempting move out of turn rejected: "${err.message}" (code: ${err.code})`);
      resolve(err);
    });
  });
  blackSocket.emit('match:move', { matchId, from: 'a7', to: 'a6' });
  await illegalMovePromise;

  console.log('\n=== STEP 8: Testing REST Reconnection & Move History Persistence ===');
  const matchInDb = await getMatchDetails(matchId, student1.cookieHeader);
  console.log(`  ✓ REST GET /matches/:id:`);
  console.log(`    Status: ${matchInDb.status}`);
  console.log(`    FEN: ${matchInDb.currentFen}`);
  console.log(`    PGN: ${matchInDb.pgn}`);
  console.log(`    Active Turn: ${matchInDb.activeTurn}`);

  const movesInDb = await getMatchMoves(matchId, student1.cookieHeader);
  console.log(`  ✓ REST GET /matches/:id/moves returned ${movesInDb.length} moves in PostgreSQL:`);
  movesInDb.forEach((m) => {
    console.log(`    Ply ${m.ply}: ${m.moveNotation} (${m.fromSquare} -> ${m.toSquare})`);
  });

  if (movesInDb.length !== 4) {
    throw new Error(`Expected exactly 4 persisted moves, got ${movesInDb.length}`);
  }

  console.log('\n=== STEP 9: Testing Resignation Flow ===');
  const endedPromise = new Promise((resolve) => {
    whiteSocket.once('match:ended', (data) => {
      console.log(`  ✓ White received match:ended: result=${data.result}, reason=${data.reason}, winnerId=${data.winnerId}`);
      resolve(data);
    });
  });
  blackSocket.emit('match:resign', { matchId });
  const endedData = await endedPromise;

  if (endedData.result !== 'white_win' || endedData.reason !== 'resignation') {
    throw new Error(`Unexpected match end payload: ${JSON.stringify(endedData)}`);
  }

  console.log('\n=== STEP 10: Final Database Verification ===');
  const finalMatch = await getMatchDetails(matchId, student1.cookieHeader);
  console.log(`  Status in DB: ${finalMatch.status}`);
  console.log(`  Result in DB: ${finalMatch.result}`);
  console.log(`  Reason in DB: ${finalMatch.reason}`);
  console.log(`  Winner in DB: ${finalMatch.winnerId} (${whiteStudent.user.name})`);
  console.log(`  EndedAt in DB: ${finalMatch.endedAt}`);

  // Disconnect sockets
  socket1.disconnect();
  socket2.disconnect();

  console.log('\n=============================================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED: LIVE GAMEPLAY LOOP IS FULLY OPERATIONAL!');
  console.log('=============================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Integration test failed:', err);
  process.exit(1);
});
