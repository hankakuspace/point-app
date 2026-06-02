// src/app/api/points/csv-bulk-add/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import { requireShopifySessionToken } from "@/lib/shopifySessionToken";

export const runtime = "nodejs";

type CsvRow = {
  customerId: string;
  email: string;
  points: number;
  reason: string;
  lineNumber: number;
};

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());

  return values;
}

function parseCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      rows: [] as CsvRow[],
      errors: ["CSVにデータ行がありません。"],
    };
  }

  const headers = parseCsvLine(lines[0]).map((header) =>
    header.trim().toLowerCase()
  );

  const customerIdIndex = headers.indexOf("customerid");
  const emailIndex = headers.indexOf("email");
  const pointsIndex = headers.indexOf("points");
  const reasonIndex = headers.indexOf("reason");

  const errors: string[] = [];

  if (customerIdIndex === -1 && emailIndex === -1) {
    errors.push("customerId または email の列が必要です。");
  }

  if (pointsIndex === -1) {
    errors.push("points の列が必要です。");
  }

  if (errors.length > 0) {
    return {
      rows: [] as CsvRow[],
      errors,
    };
  }

  const rows: CsvRow[] = [];

  lines.slice(1).forEach((line, lineOffset) => {
    const lineNumber = lineOffset + 2;
    const values = parseCsvLine(line);

    const customerId =
      customerIdIndex >= 0 ? String(values[customerIdIndex] || "").trim() : "";
    const email =
      emailIndex >= 0
        ? String(values[emailIndex] || "")
            .trim()
            .toLowerCase()
        : "";
    const points = Number(values[pointsIndex]);
    const reason =
      reasonIndex >= 0 ? String(values[reasonIndex] || "").trim() : "";

    if (!customerId && !email) {
      errors.push(`${lineNumber}行目: customerId または email が必要です。`);
      return;
    }

    if (!Number.isFinite(points) || points <= 0) {
      errors.push(`${lineNumber}行目: points は正の数で指定してください。`);
      return;
    }

    rows.push({
      customerId,
      email,
      points,
      reason,
      lineNumber,
    });
  });

  return {
    rows,
    errors,
  };
}

async function findCustomer(row: CsvRow, shop: string) {
  if (row.customerId) {
    const snap = await db.collection("customers").doc(row.customerId).get();

    if (!snap.exists) {
      return null;
    }

    return {
      id: snap.id,
      data: snap.data() || {},
      ref: snap.ref,
    };
  }

  const emailSnap = await db
    .collection("customers")
    .where("shop", "==", shop)
    .where("email", "==", row.email)
    .limit(1)
    .get();

  if (emailSnap.empty) {
    return null;
  }

  const doc = emailSnap.docs[0];

  return {
    id: doc.id,
    data: doc.data() || {},
    ref: doc.ref,
  };
}

export async function POST(req: NextRequest) {
  try {
    const requestedShop = req.nextUrl.searchParams.get("shop") || "";
    const session = await requireShopifySessionToken(req, requestedShop);

    if (!session.ok) {
      return session.response;
    }

    const shop = session.shop;

    if (!shop) {
      return NextResponse.json(
        { success: false, error: "Missing shop" },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const csvFile = formData.get("csv");
    const defaultReason = String(
      formData.get("reason") || "csv_import"
    ).trim();

    if (!csvFile || typeof (csvFile as { text?: unknown }).text !== "function") {
      return NextResponse.json(
        { success: false, error: "CSVファイルを選択してください。" },
        { status: 400 }
      );
    }

    const csvText = await (csvFile as { text: () => Promise<string> }).text();
    const { rows, errors } = parseCsv(csvText);

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "CSVの内容にエラーがあります。",
          errors,
        },
        { status: 400 }
      );
    }

    let successCount = 0;
    const failedRows: Array<{
      lineNumber: number;
      customerId: string;
      email: string;
      reason: string;
    }> = [];

    for (const row of rows) {
      const foundCustomer = await findCustomer(row, shop);

      if (!foundCustomer) {
        failedRows.push({
          lineNumber: row.lineNumber,
          customerId: row.customerId,
          email: row.email,
          reason: "顧客が見つかりません。",
        });
        continue;
      }

      const customerShop =
        typeof foundCustomer.data.shop === "string"
          ? foundCustomer.data.shop.trim().toLowerCase()
          : "";

      if (customerShop !== shop) {
        failedRows.push({
          lineNumber: row.lineNumber,
          customerId: row.customerId || foundCustomer.id,
          email: row.email,
          reason: "対象ストアの顧客ではありません。",
        });
        continue;
      }

      const currentPoints =
        typeof foundCustomer.data.points === "number" &&
        Number.isFinite(foundCustomer.data.points)
          ? foundCustomer.data.points
          : 0;

      const nextPoints = currentPoints + row.points;
      const reason = row.reason || defaultReason || "csv_import";

      await db.runTransaction(async (transaction) => {
        transaction.update(foundCustomer.ref, {
          points: nextPoints,
        });

        transaction.set(db.collection("point_logs").doc(), {
          customerId: foundCustomer.id,
          shop,
          type: "add",
          points: row.points,
          orderId: null,
          reason,
          timestamp: new Date().toISOString(),
        });
      });

      successCount += 1;
    }

    return NextResponse.json({
      success: true,
      totalRows: rows.length,
      successCount,
      failedCount: failedRows.length,
      failedRows,
    });
  } catch (error: any) {
    console.error("Error in POST /api/points/csv-bulk-add:", error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Internal Server Error",
      },
      { status: 500 }
    );
  }
}
