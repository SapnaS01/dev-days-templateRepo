import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

async function seedMixedRelations(db: Database): Promise<{
    strategy: { id: number; name: string };
    puzzle: { id: number; name: string };
    pubOne: { id: number; name: string };
    pubTwo: { id: number; name: string };
}> {
    const [strategy] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id, name: categories.name });
    const [puzzle] = await db
        .insert(categories)
        .values({ name: 'Puzzle', description: 'cat' })
        .returning({ id: categories.id, name: categories.name });
    const [pubOne] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id, name: publishers.name });
    const [pubTwo] = await db
        .insert(publishers)
        .values({ name: 'Pub Two', description: 'pub' })
        .returning({ id: publishers.id, name: publishers.name });

    await db.insert(games).values([
        {
            title: 'Alpha',
            description: 'Alpha description',
            starRating: 4.5,
            categoryId: strategy.id,
            publisherId: pubOne.id,
        },
        {
            title: 'Beta',
            description: 'Beta description',
            starRating: 4.1,
            categoryId: strategy.id,
            publisherId: pubTwo.id,
        },
        {
            title: 'Gamma',
            description: 'Gamma description',
            starRating: 3.9,
            categoryId: puzzle.id,
            publisherId: pubTwo.id,
        },
    ]);

    return { strategy, puzzle, pubOne, pubTwo };
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('filters games by category', async () => {
        const { strategy } = await seedMixedRelations(db);
        const filtered = await getAllGames(db, { categoryIds: [strategy.id] });
        expect(filtered.map((game) => game.title)).toEqual(['Alpha', 'Beta']);
    });

    it('filters games by publisher', async () => {
        const { pubTwo } = await seedMixedRelations(db);
        const filtered = await getAllGames(db, { publisherIds: [pubTwo.id] });
        expect(filtered.map((game) => game.title)).toEqual(['Beta', 'Gamma']);
    });

    it('combines category and publisher filters', async () => {
        const { strategy, pubTwo } = await seedMixedRelations(db);
        const filtered = await getAllGames(db, {
            categoryIds: [strategy.id],
            publisherIds: [pubTwo.id],
        });
        expect(filtered.map((game) => game.title)).toEqual(['Beta']);
        expect(await getAllGameIds(db, {
            categoryIds: [strategy.id],
            publisherIds: [pubTwo.id],
        })).toEqual(filtered.map((game) => game.id));
    });

    it('returns an empty collection when no games match the selection', async () => {
        const { puzzle, pubOne } = await seedMixedRelations(db);
        const filtered = await getAllGames(db, {
            categoryIds: [puzzle.id],
            publisherIds: [pubOne.id],
        });
        expect(filtered).toEqual([]);
        expect(await getAllGameIds(db, { categoryIds: [999], publisherIds: [999] })).toEqual([]);
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
