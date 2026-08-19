import * as fs from "fs";
import * as path from "path";
import { parse } from "papaparse";

interface FieldInfo {
  name: string;
  type: string;
  nullCount: number;
  uniqueValues: Set<string>;
  sampleValues: string[];
  issues: string[];
}

interface FileAnalysis {
  filePath: string;
  fileName: string;
  fileSize: string;
  totalRows: number;
  totalColumns: number;
  headers: string[];
  fields: Map<string, FieldInfo>;
  issues: string[];
}

async function analyzeXLSX(filePath: string): Promise<FileAnalysis> {
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const analysis: FileAnalysis = {
    filePath,
    fileName: path.basename(filePath),
    fileSize: fs.statSync(filePath).size.toLocaleString(),
    totalRows: 0,
    totalColumns: 0,
    headers: [],
    fields: new Map(),
    issues: [],
  };

  // Process first sheet
  const sheet = wb.worksheets[0];
  if (!sheet) {
    analysis.issues.push("❌ No sheets found");
    return analysis;
  }

  const rows: any[] = [];
  sheet.eachRow((row: any) => {
    rows.push(row.values);
  });

  if (rows.length === 0) {
    analysis.issues.push("❌ Sheet is empty");
    return analysis;
  }

  // Headers from first row
  const headers = rows[0].filter((v: any) => v !== null && v !== undefined);
  analysis.headers = headers;
  analysis.totalColumns = headers.length;
  analysis.totalRows = rows.length - 1; // Excluding header

  console.log(`📊 XLSX Analysis: ${analysis.fileName}`);
  console.log(`   Rows: ${analysis.totalRows}, Columns: ${analysis.totalColumns}`);
  console.log(`   Size: ${analysis.fileSize}`);
  console.log(`   Headers: ${headers.join(" | ")}`);

  // Analyze each column
  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const header = headers[colIdx];
    const fieldInfo: FieldInfo = {
      name: header,
      type: "STRING",
      nullCount: 0,
      uniqueValues: new Set(),
      sampleValues: [],
      issues: [],
    };

    for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
      const cell = rows[rowIdx][colIdx];
      const value = cell?.toString().trim() || "";

      if (!value || value === "undefined" || value === "null") {
        fieldInfo.nullCount++;
      } else {
        fieldInfo.uniqueValues.add(value);
        if (fieldInfo.sampleValues.length < 3) {
          fieldInfo.sampleValues.push(value);
        }
      }
    }

    // Detect type
    if (fieldInfo.sampleValues.length > 0) {
      const sample = fieldInfo.sampleValues[0];
      if (!isNaN(Number(sample))) {
        fieldInfo.type = "NUMBER";
      } else if (/^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{4}/.test(sample)) {
        fieldInfo.type = "DATE";
      }
    }

    analysis.fields.set(header, fieldInfo);
  }

  console.log(`✅ XLSX analysis complete\n`);
  return analysis;
}

async function analyzeCSV(filePath: string): Promise<FileAnalysis> {
  const content = fs.readFileSync(filePath, "utf-8");
  const stats = fs.statSync(filePath);

  const analysis: FileAnalysis = {
    filePath,
    fileName: path.basename(filePath),
    fileSize: stats.size.toLocaleString(),
    totalRows: 0,
    totalColumns: 0,
    headers: [],
    fields: new Map(),
    issues: [],
  };

  // Detect delimiter
  const firstLine = content.split("\n")[0];
  let delimiter = ",";
  if (firstLine.includes(";")) delimiter = ";";
  else if (firstLine.includes("\t")) delimiter = "\t";

  const result = parse(content, {
    delimiter,
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    analysis.issues.push(
      `⚠️  CSV parsing errors: ${result.errors.map((e: any) => e.message).join(", ")}`
    );
  }

  const rows = result.data as Record<string, any>[];
  analysis.headers = Object.keys(rows[0] || {});
  analysis.totalColumns = analysis.headers.length;
  analysis.totalRows = rows.length;

  console.log(`📊 CSV Analysis: ${analysis.fileName}`);
  console.log(`   Rows: ${analysis.totalRows}, Columns: ${analysis.totalColumns}`);
  console.log(`   Size: ${analysis.fileSize}`);
  console.log(`   Delimiter: "${delimiter}"`);
  console.log(`   Headers: ${analysis.headers.join(" | ")}`);

  // Analyze each column
  for (const header of analysis.headers) {
    const fieldInfo: FieldInfo = {
      name: header,
      type: "STRING",
      nullCount: 0,
      uniqueValues: new Set(),
      sampleValues: [],
      issues: [],
    };

    for (const row of rows) {
      const value = (row[header] || "").toString().trim();

      if (!value || value === "undefined" || value === "null") {
        fieldInfo.nullCount++;
      } else {
        fieldInfo.uniqueValues.add(value);
        if (fieldInfo.sampleValues.length < 3) {
          fieldInfo.sampleValues.push(value);
        }
      }
    }

    // Detect type
    if (fieldInfo.sampleValues.length > 0) {
      const sample = fieldInfo.sampleValues[0];
      if (!isNaN(Number(sample))) {
        fieldInfo.type = "NUMBER";
      } else if (/^\d{4}-\d{2}-\d{2}|^\d{1,2}\/\d{1,2}\/\d{4}/.test(sample)) {
        fieldInfo.type = "DATE";
      }
    }

    analysis.fields.set(header, fieldInfo);
  }

  console.log(`✅ CSV analysis complete\n`);
  return analysis;
}

function generateFieldReport(analysis: FileAnalysis): void {
  console.log(`\n📋 FIELD REPORT: ${analysis.fileName}`);
  console.log("=".repeat(80));
  console.log(
    "| Campo | Tipo | Nulls | Únicos | Ejemplo | Problemas |"
  );
  console.log("|-------|------|-------|--------|---------|-----------|");

  for (const [name, info] of analysis.fields) {
    const nullPct = analysis.totalRows
      ? ((info.nullCount / analysis.totalRows) * 100).toFixed(0)
      : "0";
    const example = info.sampleValues[0] || "(vacío)";
    const issues =
      info.issues.length > 0 ? info.issues.join("; ") : "ninguno";

    console.log(
      `| ${name} | ${info.type} | ${info.nullCount}(${nullPct}%) | ${info.uniqueValues.size} | ${example.substring(0, 20)} | ${issues} |`
    );
  }
  console.log("=".repeat(80) + "\n");
}

function compareAnalyses(xlsx: FileAnalysis, csv: FileAnalysis): void {
  console.log("\n🔍 COMPARISON: XLSX vs CSV");
  console.log("=".repeat(80));

  console.log(`\n📊 Totals:`);
  console.log(`   XLSX: ${xlsx.totalRows} rows`);
  console.log(`   CSV:  ${csv.totalRows} rows`);
  console.log(`   Difference: ${Math.abs(xlsx.totalRows - csv.totalRows)} rows`);

  console.log(`\n📝 Headers:`);
  const xlsxHeaders = new Set(xlsx.headers);
  const csvHeaders = new Set(csv.headers);

  const onlyXlsx = [...xlsxHeaders].filter((h) => !csvHeaders.has(h));
  const onlyCSV = [...csvHeaders].filter((h) => !xlsxHeaders.has(h));
  const common = [...xlsxHeaders].filter((h) => csvHeaders.has(h));

  if (common.length > 0)
    console.log(`   ✅ Common: ${common.join(", ")}`);
  if (onlyXlsx.length > 0)
    console.log(`   ➕ Only in XLSX: ${onlyXlsx.join(", ")}`);
  if (onlyCSV.length > 0)
    console.log(`   ➕ Only in CSV: ${onlyCSV.join(", ")}`);

  console.log("=".repeat(80) + "\n");
}

async function main() {
  const projectRoot = "/var/www/apps/uix";
  const xlsxPath = path.join(projectRoot, "Pruebas Maria 2.0.xlsx");
  const csvPath = path.join(projectRoot, "Pruebas Maria 2.csv");

  console.log("🔍 AUDIT: Import Data Analysis\n");

  const xlsx = await analyzeXLSX(xlsxPath);
  const csv = await analyzeCSV(csvPath);

  generateFieldReport(xlsx);
  generateFieldReport(csv);
  compareAnalyses(xlsx, csv);

  // Save analysis
  const report = {
    timestamp: new Date().toISOString(),
    xlsx,
    csv,
  };

  const reportPath = path.join(projectRoot, "audit-import-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`✅ Report saved to: ${reportPath}\n`);
}

main().catch(console.error);
