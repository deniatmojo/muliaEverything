# AGENTS.md — Mulia Everything (Enterprise Portal)

Portal internal perusahaan: frontend React + Vite + Tailwind (dark mode class-based, palet `aira`), backend Express + MySQL (JWT, RBAC menu via `roles.akses_menu`), deploy via git pull + `deploy.sh` di server (pm2: `mulia-backend`).

## WAJIB: Gunakan graphify untuk hemat token

Folder ini punya knowledge graph kode di `graphify-out/` (dibangun dengan [graphify](https://github.com/sentropic/graphify)). **Sebelum mengeksplorasi kode apa pun, baca graph dulu** — jangan baca file satu per satu kalau graph sudah menjawab.

### Awal setiap sesi / sebelum menjawab pertanyaan soal kode

```
graphify query "pertanyaan"          # BFS graph untuk topik tertentu (budget token otomatis)
graphify explain "namaFungsi"        # jelaskan node + tetangganya
graphify path "A" "B"                # jalur relasi antar dua node
graphify affected "X"                # node apa saja terdampak jika X diubah
graphify god-nodes --top 10          # hub arsitektur paling penting
```

Ringkasan arsitektur & komunitas modul: baca `graphify-out/GRAPH_REPORT.md`.
Konvensi detail (tema, RBAC, struktur modul) tetap lihat langsung file terkait bila graph kurang spesifik.

### Setelah setiap perubahan kode (wajib, murah — tanpa LLM)

```
graphify update .          # dari root repo; rebuild incremental graph
```

Jika `graphify watch` sedang berjalan di latar, graph ter-update otomatis dan langkah ini tidak diperlukan.

### Jika graph belum ada / rusak

```
graphify update .          # build ulang dari nol pun perintah yang sama
```

## Catatan deploy (production)

- Server: `ssh deniatmojoo@203.145.34.153`, folder `/www/wwwroot/mulia.airadynamics.com`
- Alur: commit + push ke `origin/master` → jalankan `bash deploy.sh` di server (pull, npm install, build, pm2 restart)
- Database production dipakai user nyata: **periksa diff SQL sebelum deploy**; migrasi hanya boleh additive (`CREATE TABLE IF NOT EXISTS` dst.), jalankan manual file `backend/sql/migration_*.sql` di server bila ada yang baru, jangan pernah DROP/ALTER data yang sudah terisi.
- Nginx: HTTP selalu redirect ke HTTPS (fix CORS) — jangan diubah.
