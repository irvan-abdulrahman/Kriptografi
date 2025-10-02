import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Download, Copy, Wand2, Lock, Unlock, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

// --- Utilities for Playfair ---
const alphabet = "ABCDEFGHIKLMNOPQRSTUVWXYZ"; // J omitted by default

function sanitize(text, keepSpaces = false) {
  const lettersOnly = text
    .toUpperCase()
    .replace(/J/g, "I")
    .replace(/[^A-Z]/g, keepSpaces ? " " : "")
    .replace(/\s+/g, keepSpaces ? " " : "");
  return lettersOnly;
}

function buildKeySquare(key, includeJ = false) {
  let baseAlpha = includeJ ? "ABCDEFGHIJKLMNOPQRSTUVWXYZ" : alphabet;
  const seen = new Set();
  const stream = (sanitize(key).replace(/J/g, includeJ ? "J" : "I") + baseAlpha)
    .split("")
    .filter((ch) => {
      if (!baseAlpha.includes(ch)) return false;
      if (seen.has(ch)) return false;
      seen.add(ch);
      return true;
    });
  const grid = [];
  for (let i = 0; i < 25 + (includeJ ? 1 : 0) - (includeJ ? 0 : 0); i += 5) {
    grid.push(stream.slice(i, i + 5));
  }
  // If includeJ, we still show a 5x5 (classic variant). If turned on, treat I/J as distinct by replacing I/J mapping below.
  return grid.slice(0, 5);
}

function posMap(grid) {
  const map = new Map();
  grid.forEach((row, r) => row.forEach((ch, c) => map.set(ch, { r, c })));
  return map;
}

function digraphs(text, filler = "X") {
  const t = sanitize(text);
  const pairs = [];
  let i = 0;
  while (i < t.length) {
    const a = t[i];
    let b = t[i + 1];
    if (!b) {
      pairs.push([a, filler]);
      i += 1;
      break;
    }
    if (a === b) {
      pairs.push([a, filler]);
      i += 1; // insert filler after a
    } else {
      pairs.push([a, b]);
      i += 2;
    }
  }
  if (pairs.length && pairs[pairs.length - 1].length === 1) {
    pairs[pairs.length - 1].push(filler);
  }
  return pairs;
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

function encPair([a, b], grid, map) {
  const A = map.get(a === "J" ? "I" : a);
  const B = map.get(b === "J" ? "I" : b);
  let ar = A.r,
    ac = A.c,
    br = B.r,
    bc = B.c;
  if (ar === br) {
    // same row
    return [grid[ar][mod(ac + 1, 5)], grid[br][mod(bc + 1, 5)]];
  }
  if (ac === bc) {
    // same col
    return [grid[mod(ar + 1, 5)][ac], grid[mod(br + 1, 5)][bc]];
  }
  // rectangle
  return [grid[ar][bc], grid[br][ac]];
}

function decPair([a, b], grid, map) {
  const A = map.get(a === "J" ? "I" : a);
  const B = map.get(b === "J" ? "I" : b);
  let ar = A.r,
    ac = A.c,
    br = B.r,
    bc = B.c;
  if (ar === br) {
    // same row
    return [grid[ar][mod(ac - 1, 5)], grid[br][mod(bc - 1, 5)]];
  }
  if (ac === bc) {
    // same col
    return [grid[mod(ar - 1, 5)][ac], grid[mod(br - 1, 5)][bc]];
  }
  // rectangle
  return [grid[ar][bc], grid[br][ac]];
}

function runPlayfair({
  text,
  key,
  mode,
  filler = "X",
  keepSpaces = false,
  includeJ = false,
}) {
  const grid = buildKeySquare(key, includeJ);
  const map = posMap(grid);
  const pairs = digraphs(text, filler);
  const steps = [];
  const out = pairs.map((p) => {
    const fn = mode === "encrypt" ? encPair : decPair;
    const res = fn(p, grid, map);
    steps.push({ in: p, out: res });
    return res.join("");
  });
  let result = out.join("");
  if (keepSpaces) {
    // Re-insert spaces based on original text shape (simple heuristic)
    const shape = text.replace(/[^A-Za-z\s]/g, "");
    const words = shape.trim().split(/\s+/);
    let idx = 0,
      acc = [];
    for (const w of words) {
      const piece = result.slice(idx, idx + w.replace(/[^A-Za-z]/g, "").length);
      idx += piece.length;
      acc.push(piece);
    }
    result = acc.join(" ");
  }
  return { grid, pairs, steps, result };
}

function copyToClipboard(t) {
  navigator.clipboard.writeText(t);
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function PlayfairDashboard() {
  const [text, setText] = useState("");
  const [key, setKey] = useState("KRIPTOGRAFI");
  const [mode, setMode] = useState("encrypt");
  const [filler, setFiller] = useState("X");
  const [keepSpaces, setKeepSpaces] = useState(true);
  const [includeJ, setIncludeJ] = useState(false);

  const { grid, pairs, steps, result } = useMemo(
    () => runPlayfair({ text, key, mode, filler, keepSpaces, includeJ }),
    [text, key, mode, filler, keepSpaces, includeJ]
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <motion.h1
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-4xl font-bold tracking-tight"
        >
          Playfair Cipher Studio
        </motion.h1>
        <p className="text-slate-600">
          Dashboard interaktif untuk enkripsi & dekripsi teks dengan{" "}
          <span className="font-semibold">Playfair Cipher</span>. Masukkan{" "}
          <em>key</em>, atur opsi, dan lihat langkah per langkahnya.
        </p>

        <div className="grid md:grid-cols-5 gap-4">
          {/* Left controls */}
          <Card className="md:col-span-2 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>Key</Label>
                <Input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="Contoh: KRIPTOGRAFI"
                />
              </div>

              <div className="space-y-2">
                <Label>Masukan Teks</Label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  placeholder="Ketik teks di sini..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Filler (untuk double huruf/ganjil)</Label>
                  <Input
                    value={filler}
                    maxLength={1}
                    onChange={(e) =>
                      setFiller(
                        e.target.value.replace(/[^A-Za-z]/g, "").toUpperCase()
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <Tabs value={mode} onValueChange={setMode} className="w-full">
                    <TabsList className="w-full">
                      <TabsTrigger value="encrypt" className="w-1/2 flex gap-2">
                        <Lock className="h-4 w-4" />
                        Enkrip
                      </TabsTrigger>
                      <TabsTrigger value="decrypt" className="w-1/2 flex gap-2">
                        <Unlock className="h-4 w-4" />
                        Dekrip
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={keepSpaces}
                    onCheckedChange={setKeepSpaces}
                    id="keepSpaces"
                  />
                  <Label htmlFor="keepSpaces">Pertahankan spasi</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={includeJ}
                    onCheckedChange={setIncludeJ}
                    id="includeJ"
                  />
                  <Label htmlFor="includeJ">Pisahkan I/J (varian modern)</Label>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setText("");
                  }}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reset Teks
                </Button>
                <Button
                  onClick={() => copyToClipboard(result)}
                  className="gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Salin Hasil
                </Button>
                <Button
                  onClick={() => downloadText(`playfair-${mode}.txt`, result)}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  Unduh .txt
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Right panel: output & visualization */}
          <div className="md:col-span-3 space-y-4">
            <Card className="shadow-sm">
              <CardContent className="p-4 space-y-3">
                <Label>Hasil</Label>
                <Textarea
                  value={result}
                  readOnly
                  rows={4}
                  className="font-mono"
                />
                <p className="text-xs text-slate-500">
                  Catatan: huruf J diubah menjadi I pada varian klasik 5×5.
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Matriks Kunci 5×5</Label>
                    <Wand2 className="h-4 w-4" />
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {grid.flat().map((ch, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-2xl border flex items-center justify-center font-bold bg-white"
                      >
                        {ch}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardContent className="p-4 space-y-3">
                  <Label>Digraf (pasangan huruf)</Label>
                  <div className="flex flex-wrap gap-2">
                    {pairs.map((p, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full bg-slate-100 font-mono text-sm"
                      >
                        {p.join("")}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="shadow-sm">
              <CardContent className="p-4 space-y-3">
                <Label>Langkah Per Langkah</Label>
                <div className="space-y-2">
                  {steps.map((s, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-3 items-center gap-2 text-sm"
                    >
                      <div className="font-mono">{s.in.join("")}</div>
                      <div className="text-center">→</div>
                      <div className="font-mono font-semibold">
                        {s.out.join("")}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-slate-600 leading-relaxed">
              <span className="font-semibold">Tentang Playfair:</span> Algoritma
              substitusi digraf yang menggunakan matriks kunci 5×5. Aturan: (1)
              satu baris → geser kanan; (2) satu kolom → geser bawah; (3)
              persegi panjang → tukar kolom. Untuk dekripsi arah geser dibalik.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
