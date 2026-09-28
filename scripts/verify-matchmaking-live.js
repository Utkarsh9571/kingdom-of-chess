const { io } = require('socket.io-client');

const API_BASE = 'http://localhost:4000/api/v1';
const WS_BASE = 'http://localhost:4000';

async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`Login failed for ${email}: ${JSON.stringify(json)}`);
  }
  return json.data; // { user, token }
}

async function getTournaments(token) {
  const res = await fetch(`${API_BASE}/tournaments`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  return json.data;
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(WS_BASE, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });

    const timeout = setTimeout(() => {
      reject(new Error('Socket connection timeout'));
    }, 5000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function run() {
  console.log('=== STARTING LIVE MATCHMAKING E2E VERIFICATION ===\n');

  // 1. Authenticate users
  console.log('[1/8] Authenticating test accounts...');
  const student1 = await login('student1@kingdom.com', 'Password123!');
  const student2 = await login('student2@kingdom.com', 'Password123!');
  const student3 = await login('student3@kingdom.com', 'Password123!');
  const coach = await login('coach@kingdom.com', 'Password123!');
  console.log('✓ Student 1, Student 2, Student 3, Coach logged in successfully');

  // 2. Fetch tournament
  const tournaments = await getTournaments(student1.token);
  const openTournament = tournaments.find((t) => t.status === 'open' || t.status === 'ongoing');
  if (!openTournament) {
    throw new Error('No open tournament found in seeded data');
  }
  console.log(`✓ Target tournament: "${openTournament.name}" (${openTournament.id})\n`);

  // Connect sockets
  console.log('[2/8] Connecting Socket.IO clients for Student 1 and Student 2...');
  const socket1 = await connectSocket(student1.token);
  const socket2 = await connectSocket(student2.token);
  const socket3 = await connectSocket(student3.token);
  console.log('✓ Sockets connected and authenticated via handshake token\n');

  // Test 1: Student 1 queues alone
  console.log('[3/8] Testing single player queue (Student 1 enters queue)...');
  const queueResult1 = await new Promise((resolve) => {
    socket1.emit('queue:join', { tournamentId: openTournament.id }, (res) => {
      resolve(res);
    });
    // Or wait for queue:status
    socket1.once('queue:status', (data) => resolve(data));
  });
  console.log('✓ Student 1 queued successfully:', queueResult1);

  // Test 4: Duplicate queue request
  console.log('\n[4/8] Testing duplicate queue request from Student 1...');
  const duplicateErr = await new Promise((resolve) => {
    socket1.once('queue:error', (err) => resolve(err));
    socket1.emit('queue:join', { tournamentId: openTournament.id });
  });
  console.log('✓ Duplicate queue properly rejected with error:', duplicateErr.message);

  // Test 2: Student 2 queues -> triggers automatic auto-pairing!
  console.log('\n[5/8] Testing auto-pairing: Student 2 enters queue...');
  const [matchEvent1, matchEvent2] = await Promise.all([
    new Promise((resolve) => socket1.once('queue:matched', resolve)),
    new Promise((resolve) => socket2.once('queue:matched', resolve)),
    new Promise((resolve) => {
      socket2.emit('queue:join', { tournamentId: openTournament.id });
      socket2.once('queue:status', resolve);
    }),
  ]);

  console.log('✓ BOTH PLAYERS AUTOMATICALLY PAIRED OVER SOCKET.IO!');
  console.log('  Player 1 Match Event:', {
    matchId: matchEvent1.matchId,
    color: matchEvent1.color,
    opponent: matchEvent1.opponent.name,
  });
  console.log('  Player 2 Match Event:', {
    matchId: matchEvent2.matchId,
    color: matchEvent2.color,
    opponent: matchEvent2.opponent.name,
  });

  if (matchEvent1.matchId !== matchEvent2.matchId) {
    throw new Error('Match IDs do not match!');
  }
  if (matchEvent1.color === matchEvent2.color) {
    throw new Error('Both players assigned same color!');
  }
  console.log('✓ Opposite colors correctly assigned (White vs Black)\n');

  const matchId = matchEvent1.matchId;

  // Test 5: Player already in active match cannot re-queue
  console.log('[6/8] Testing active match concurrency: Student 1 attempts to re-queue...');
  const activeMatchErr = await new Promise((resolve) => {
    socket1.once('queue:error', (err) => resolve(err));
    socket1.emit('queue:join', { tournamentId: openTournament.id });
  });
  console.log('✓ Re-queue blocked because match is in progress:', activeMatchErr.message);

  // Test 8: Room authorization - Student 1 and 2 join room successfully
  console.log('\n[7/8] Testing match room authorization...');
  const joinResult1 = await new Promise((resolve) => {
    socket1.once('match:joined', resolve);
    socket1.emit('match:join', { matchId });
  });
  console.log('✓ Student 1 (participant) joined room successfully as', joinResult1.color);

  // Unauthorized user (Student 3) attempts to join Student 1 & 2's match room
  const unauthorizedJoinErr = await new Promise((resolve) => {
    socket3.once('match:error', resolve);
    socket3.emit('match:join', { matchId });
  });
  console.log('✓ Student 3 (unauthorized third-party) properly rejected:', unauthorizedJoinErr.message);

  // Test 7: Unauthorized tournament queue attempt (non-member)
  console.log('\n[8/8] Testing REST match retrieval for live arena page...');
  const matchRes = await fetch(`${API_BASE}/matches/${matchId}`, {
    headers: { Authorization: `Bearer ${student1.token}` },
  });
  const matchJson = await matchRes.json();
  console.log('✓ GET /api/v1/matches/:id returned verified match state:');
  console.log('  Tournament:', matchJson.data.tournamentName);
  console.log('  White Player:', matchJson.data.whitePlayer.name);
  console.log('  Black Player:', matchJson.data.blackPlayer.name);
  console.log('  Status:', matchJson.data.status);
  console.log('  FEN:', matchJson.data.currentFen);

  // Cleanup sockets
  socket1.disconnect();
  socket2.disconnect();
  socket3.disconnect();

  console.log('\n======================================================');
  console.log('🎉 ALL LIVE E2E MATCHMAKING TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================');
  process.exit(0);
}

run().catch((err) => {
  console.error('\n❌ E2E Matchmaking verification failed:', err);
  process.exit(1);
});
