/**
 * expenseStore — local persistence and CSV export for receipts (spec 1.4).
 *
 * Expenses live on-device until the backend has an expenses table. Records keep
 * the receipt image URI so the user can re-check the original.
 */

import * as FileSystem from "expo-file-system/legacy";

const FILE = "expenses.json";

function path() {
    return `${FileSystem.documentDirectory}${FILE}`;
}

export async function listExpenses() {
    try {
        const info = await FileSystem.getInfoAsync(path());
        if (!info.exists) return [];
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(path()));
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

async function writeAll(list) {
    await FileSystem.writeAsStringAsync(path(), JSON.stringify(list));
}

export async function saveExpense(expense) {
    const record = {
        id: `exp_${Date.now()}`,
        createdAt: new Date().toISOString(),
        ...expense,
    };
    const all = await listExpenses();
    await writeAll([record, ...all]);
    return record;
}

export async function updateExpense(id, patch) {
    const all = await listExpenses();
    const next = all.map((e) => (e.id === id ? { ...e, ...patch } : e));
    await writeAll(next);
    return next;
}

export async function deleteExpense(id) {
    const all = await listExpenses();
    const next = all.filter((e) => e.id !== id);
    await writeAll(next);
    return next;
}

/** Groups expenses into SectionList sections by month, newest month first. */
export function groupByMonth(expenses) {
    const buckets = new Map();

    for (const e of expenses) {
        const d = new Date(e.dateUtc || e.createdAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!buckets.has(key)) {
            buckets.set(key, {
                key,
                title: d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
                data: [],
                total: 0,
                currency: e.currency || "USD",
            });
        }
        const b = buckets.get(key);
        b.data.push(e);
        b.total += Number(e.total) || 0;
    }

    const sections = [...buckets.values()];
    sections.sort((a, b) => (a.key < b.key ? 1 : -1));
    for (const s of sections) {
        s.data.sort((a, b) => new Date(b.dateUtc || b.createdAt) - new Date(a.dateUtc || a.createdAt));
    }
    return sections;
}

export function monthTotal(expenses, when = new Date()) {
    const y = when.getFullYear();
    const m = when.getMonth();
    return expenses.reduce((acc, e) => {
        const d = new Date(e.dateUtc || e.createdAt);
        return d.getFullYear() === y && d.getMonth() === m ? acc + (Number(e.total) || 0) : acc;
    }, 0);
}

/**
 * RFC 4180 escaping — accountants open this in Excel, so a merchant name with a
 * comma or a quote must not shift every following column.
 */
function csvCell(value) {
    const s = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(expenses) {
    const header = ["Date", "Merchant", "Category", "Total", "Tax", "Currency", "Notes"];
    const rows = expenses.map((e) => [
        new Date(e.dateUtc || e.createdAt).toISOString().slice(0, 10),
        e.merchant,
        e.category,
        e.total,
        e.taxAmount,
        e.currency,
        e.notes,
    ]);

    return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

/** Writes the CSV to a temp file and returns its uri, ready for expo-sharing. */
export async function writeCsvFile(expenses, filename = "expenses.csv") {
    const uri = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(uri, buildCsv(expenses));
    return uri;
}
