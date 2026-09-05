import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Database } from './db';
import { games, categories, publishers } from '../../db/schema';
import type { Category, Game, Publisher } from '../types/game';

export interface GameFilters {
    categoryIds?: number[];
    publisherIds?: number[];
}

const gameSelection = {
    id: games.id,
    title: games.title,
    description: games.description,
    starRating: games.starRating,
    categoryId: categories.id,
    categoryName: categories.name,
    publisherId: publishers.id,
    publisherName: publishers.name,
};

type GameSelectionRow = {
    id: number;
    title: string;
    description: string;
    starRating: number | null;
    categoryId: number | null;
    categoryName: string | null;
    publisherId: number | null;
    publisherName: string | null;
};

function normalizeFilterValues(values?: number[]): number[] | undefined {
    if (!values || values.length === 0) {
        return undefined;
    }

    const uniqueValues = new Set<number>();
    for (const value of values) {
        if (value !== undefined && value !== null && Number.isFinite(value)) {
            uniqueValues.add(Number(value));
        }
    }

    return uniqueValues.size > 0 ? [...uniqueValues] : undefined;
}

function mapGame(row: GameSelectionRow): Game {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        starRating: row.starRating,
        category:
            row.categoryId !== null && row.categoryName !== null
                ? { id: row.categoryId, name: row.categoryName }
                : null,
        publisher:
            row.publisherId !== null && row.publisherName !== null
                ? { id: row.publisherId, name: row.publisherName }
                : null,
    };
}

function baseGamesQuery(db: Database) {
    return db
        .select(gameSelection)
        .from(games)
        .leftJoin(categories, eq(games.categoryId, categories.id))
        .leftJoin(publishers, eq(games.publisherId, publishers.id));
}

/** Return all categories sorted alphabetically for filter controls. */
export async function getAllCategories(db: Database): Promise<Category[]> {
    const rows = await db.select().from(categories).orderBy(asc(categories.name));
    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/** Return all publishers sorted alphabetically for filter controls. */
export async function getAllPublishers(db: Database): Promise<Publisher[]> {
    const rows = await db.select().from(publishers).orderBy(asc(publishers.name));
    return rows.map((row) => ({ id: row.id, name: row.name }));
}

/** All games ordered by title, optionally narrowed to one or more categories and publishers. */
export async function getAllGames(db: Database, filters: GameFilters = {}): Promise<Game[]> {
    const categoryIds = normalizeFilterValues(filters.categoryIds);
    const publisherIds = normalizeFilterValues(filters.publisherIds);
    const conditions = [];

    if (categoryIds && categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, categoryIds));
    }

    if (publisherIds && publisherIds.length > 0) {
        conditions.push(inArray(games.publisherId, publisherIds));
    }

    const query = conditions.length > 0 ? baseGamesQuery(db).where(and(...conditions)) : baseGamesQuery(db);
    const rows = await query.orderBy(asc(games.title));
    return rows.map(mapGame);
}

/** All game ids ordered by title, optionally narrowed by the same filter values. */
export async function getAllGameIds(db: Database, filters: GameFilters = {}): Promise<number[]> {
    const categoryIds = normalizeFilterValues(filters.categoryIds);
    const publisherIds = normalizeFilterValues(filters.publisherIds);
    const conditions = [];

    if (categoryIds && categoryIds.length > 0) {
        conditions.push(inArray(games.categoryId, categoryIds));
    }

    if (publisherIds && publisherIds.length > 0) {
        conditions.push(inArray(games.publisherId, publisherIds));
    }

    const query =
        conditions.length > 0
            ? db.select({ id: games.id }).from(games).where(and(...conditions))
            : db.select({ id: games.id }).from(games);

    const rows = await query.orderBy(asc(games.title));
    return rows.map((row) => row.id);
}

/** A single game by id, or null when it does not exist. */
export async function getGameById(db: Database, id: number): Promise<Game | null> {
    const row = await baseGamesQuery(db).where(eq(games.id, id)).get();
    return row ? mapGame(row) : null;
}
