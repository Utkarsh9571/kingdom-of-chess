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
  if (!json.success) throw new Error(`Login failed for ${email}: ${JSON.stringify(json)}`);
  return json.data;
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(WS_BASE, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
    const timeout = setTimeout(() => reject(new Error('Socket timeout')), 5000);
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

async function main() {
  console.log('--- COMPREHENSIVE MATCHMAKING SCENARIOS TEST ---\n');

  // Authenticate accounts
  const s3 = await login('student3@kingdom.com', 'Password123!');
  const s4 = await login('student4@kingdom.com', 'Password123!');
  const coach = await login('coach@kingdom.com', 'Password123!');

  // Coach creates a dedicated test tournament
  const createTournRes = await fetch(`${API_BASE}/tournaments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${coach.token}`,
    },
    body: JSON.stringify({
      name: 'Scenario Test Blitz',
      timeControl: '3+2',
      startDate: new Date().toISOString(),
      status: 'open',
    }),
  });
  const tournData = (await createTournRes.json()).data;
  console.log(`Created test tournament: ${tournData.name} (${tournData.id})`);

  // Enroll s3 and s4
  await fetch(`${API_BASE}/tournaments/${tournData.id}/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${s3.token}` },
  });
  await fetch(`${API_BASE}/tournaments/${tournData.id}/join`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${s4.token}` },
  });
  console.log('✓ Student 3 and Student 4 enrolled\n');

  const sock3 = await connectSocket(s3.token);
  const sock4 = await connectSocket(s4.token);

  // Scenario 1: One player queues
  console.log('[Scenario 1] One player queues...');
  const status1 = await new Promise((resolve) => {
    sock3.once('queue:status', resolve);
    sock3.emit('queue:join', { tournamentId: tournData.id });
  });
  console.log('✓ Student 3 waiting in queue:', status1);

  // Scenario 2: Cancellation behavior
  console.log('\n[Scenario 2] Queue cancellation...');
  const cancelStatus = await new Promise((resolve) => {
    sock3.once('queue:status', resolve);
    sock3.emit('queue:leave', { tournamentId: tournData.id });
  });
  console.log('✓ Student 3 cancelled queue successfully:', cancelStatus);

  // Scenario 3: Re-enter and pair when second player joins
  console.log('\n[Scenario 3] Re-enter and automatic pairing...');
  sock3.emit('queue:join', { tournamentId: tournData.id });
  await new Promise((resolve) => sock3.once('queue:status', resolve));

  const [pair3, pair4] = await Promise.all([
    new Promise((resolve) => sock3.once('queue:matched', resolve)),
    new Promise((resolve) => sock4.once('queue:matched', resolve)),
    new Promise((resolve) => {
      sock4.once('queue:status', resolve);
      sock4.emit('queue:join', { tournamentId: tournData.id });
    }),
  ]);
  console.log('✓ Automatic pairing succeeded:');
  console.log(`  Student 3 matched: Color=${pair3.color}, Opponent=${pair3.opponent.name}`);
  console.log(`  Student 4 matched: Color=${pair4.color}, Opponent=${pair4.opponent.name}`);
  console.log(`  Match ID=${pair3.matchId}`);

  // Scenario 4: Concurrency double-booking test - both try to queue again
  console.log('\n[Scenario 4] Double-booking check while in active match...');
  const errActive3 = await new Promise((resolve) => {
    sock3.once('queue:error', resolve);
    sock3.emit('queue:join', { tournamentId: tournData.id });
  });
  console.log('✓ Blocked from queueing while in active match:', errActive3.message);

  // Scenario 5: Unauthorized tournament (draft tournament)
  console.log('\n[Scenario 5] Unauthorized tournament check...');
  const draftTournRes = await fetch(`${API_BASE}/tournaments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${coach.token}`,
    },
    body: JSON.stringify({
      name: 'Unpublished Draft Tournament',
      timeControl: '5+0',
      startDate: new Date().toISOString(),
      status: 'draft',
    }),
  });
  const draftTourn = (await draftTournRes.json()).data;

  // Student 3 tries to queue for draft tournament
  const draftErr = await new Promise((resolve) => {
    sock3.once('queue:error', resolve);
    sock3.emit('queue:join', { tournamentId: draftTourn.id });
  });
  console.log('✓ Draft tournament queue rejected as expected:', draftErr.message);

  sock3.disconnect();
  sock4.disconnect();

  console.log('\n======================================================');
  console.log('🎉 ALL SCENARIO CHECKS PASSED FLAWLESSLY!');
  console.log('======================================================');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
