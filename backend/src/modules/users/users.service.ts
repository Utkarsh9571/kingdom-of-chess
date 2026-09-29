import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, DrizzleDb } from '../../database/database.module';
import * as schema from '../../database/schema';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async findByEmail(email: string): Promise<schema.User | null> {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase().trim()))
      .limit(1);

    return results[0] || null;
  }

  async findById(id: string): Promise<schema.User | null> {
    const results = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, id))
      .limit(1);

    return results[0] || null;
  }

  async create(data: {
    name: string;
    email: string;
    passwordHash: string;
    role?: 'STUDENT' | 'COACH';
  }): Promise<schema.User> {
    const [user] = await this.db
      .insert(schema.users)
      .values({
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        role: data.role || 'STUDENT',
      })
      .returning();

    return user;
  }
}
