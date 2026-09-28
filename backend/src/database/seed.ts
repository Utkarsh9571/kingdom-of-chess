import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as schema from './schema';
import { eq } from 'drizzle-orm';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5433/kingdom_chess';

const pool = new Pool({ connectionString });
const db = drizzle(pool, { schema });

export async function runSeed() {
  console.log('🌱 Starting database seed...');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const seedUsers = [
    {
      email: 'coach@kingdom.com',
      passwordHash,
      name: 'Coach Garry',
      role: 'COACH' as const,
    },
    {
      email: 'student1@kingdom.com',
      passwordHash,
      name: 'Anand Jr.',
      role: 'STUDENT' as const,
    },
    {
      email: 'student2@kingdom.com',
      passwordHash,
      name: 'Pragg R.',
      role: 'STUDENT' as const,
    },
    {
      email: 'student3@kingdom.com',
      passwordHash,
      name: 'Gukesh D.',
      role: 'STUDENT' as const,
    },
    {
      email: 'student4@kingdom.com',
      passwordHash,
      name: 'Vaishali R.',
      role: 'STUDENT' as const,
    },
  ];

  const createdUserMap = new Map<string, string>();

  for (const user of seedUsers) {
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, user.email));

    if (existing.length > 0) {
      await db
        .update(schema.users)
        .set({
          passwordHash: user.passwordHash,
          name: user.name,
          role: user.role,
        })
        .where(eq(schema.users.id, existing[0].id));
      createdUserMap.set(user.email, existing[0].id);
      console.log(`  Updated user: ${user.email} (${user.role})`);
    } else {
      const [inserted] = await db
        .insert(schema.users)
        .values(user)
        .returning({ id: schema.users.id });
      createdUserMap.set(user.email, inserted.id);
      console.log(`  Created user: ${user.email} (${user.role})`);
    }
  }

  const coachId = createdUserMap.get('coach@kingdom.com');
  if (coachId) {
    // Check if demo tournament exists
    const existingTournaments = await db
      .select()
      .from(schema.tournaments)
      .where(eq(schema.tournaments.name, 'Kingdom Autumn Rapid 2026'));

    let tournamentId: string;

    if (existingTournaments.length === 0) {
      const [t] = await db
        .insert(schema.tournaments)
        .values({
          name: 'Kingdom Autumn Rapid 2026',
          timeControl: '5+0',
          initialTimeSeconds: 300,
          incrementSeconds: 0,
          startDate: new Date('2026-09-29T10:00:00Z'),
          status: 'open',
          createdById: coachId,
        })
        .returning({ id: schema.tournaments.id });
      tournamentId = t.id;
      console.log(`  Created demo tournament: Kingdom Autumn Rapid 2026 (${tournamentId})`);
    } else {
      tournamentId = existingTournaments[0].id;
      console.log(`  Demo tournament already exists: (${tournamentId})`);
    }

    // Enroll students 1 through 4 into demo tournament
    for (let i = 1; i <= 4; i++) {
      const studentId = createdUserMap.get(`student${i}@kingdom.com`);
      if (studentId) {
        const existingEnrollment = await db
          .select()
          .from(schema.tournamentParticipants)
          .where(eq(schema.tournamentParticipants.userId, studentId));

        const isEnrolled = existingEnrollment.some((e) => e.tournamentId === tournamentId);
        if (!isEnrolled) {
          await db.insert(schema.tournamentParticipants).values({
            tournamentId,
            userId: studentId,
          });
          console.log(`  Enrolled student${i} into demo tournament`);
        }
      }
    }
  }

  console.log('✅ Database seed completed successfully!');
}

if (require.main === module) {
  runSeed()
    .then(() => pool.end())
    .catch((err) => {
      console.error('❌ Seeding failed:', err);
      pool.end();
      process.exit(1);
    });
}
