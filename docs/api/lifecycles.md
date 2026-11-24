# Siklus hidup status

<!-- Di-generate oleh `bun run docs:lifecycle` dari `src/lib/lifecycle`. Jangan disunting manual. -->

Perpindahan status yang sah. Yang tidak tergambar ditolak server. Label
pada panah adalah syarat yang diperiksa sebelum pindah; ditulis lewat
`transition()` atau diperiksa lewat `assertMove()` di `src/server/api/lifecycle.ts`.

## form

Keadaan: `Draft`, `Published`, `Closed`.

```mermaid
stateDiagram-v2
  Draft --> Published
  Published --> Closed
  Published --> Draft: belum ada jawaban
  Closed --> Published
  Closed --> Draft: belum ada jawaban
```

## oprec

Keadaan: `draft`, `open`, `closed`.

```mermaid
stateDiagram-v2
  draft --> open: pengaturan lengkap
  draft --> closed
  open --> draft: belum ada pendaftar
  open --> closed
  closed --> open: pengaturan lengkap
  closed --> draft: belum ada pendaftar
```

## penempatan

Keadaan: `berjalan`, `masa_banding`, `final`.

```mermaid
stateDiagram-v2
  berjalan --> masa_banding
  masa_banding --> berjalan: hasil belum dirilis
  masa_banding --> final
  final --> masa_banding
```

## rilis hasil

Keadaan: `belum_dirilis`, `dirilis`.

```mermaid
stateDiagram-v2
  belum_dirilis --> dirilis: penempatan tidak berjalan
  dirilis --> belum_dirilis
```

## permintaan pindah

Keadaan: `diminta`, `disetujui`, `ditolak`, `dibatalkan`.

```mermaid
stateDiagram-v2
  diminta --> disetujui
  diminta --> ditolak
  diminta --> dibatalkan
```

## laporan

Keadaan: `Open`, `In Progress`, `Resolved`, `Closed`, `Draft`, `Backlog`, `Reported`.

```mermaid
stateDiagram-v2
  state "In Progress" as In_Progress
  Open --> In_Progress
  Open --> Resolved
  Open --> Closed
  Open --> Draft
  Open --> Backlog
  Open --> Reported
  In_Progress --> Open
  In_Progress --> Resolved
  In_Progress --> Closed
  In_Progress --> Backlog
  Resolved --> Open
  Resolved --> Closed
  Resolved --> Backlog
  Closed --> Open
  Closed --> In_Progress
  Closed --> Resolved
  Closed --> Draft
  Closed --> Backlog
  Closed --> Reported
  Draft --> Open
  Draft --> In_Progress
  Draft --> Resolved
  Draft --> Closed
  Draft --> Backlog
  Draft --> Reported
  Backlog --> Open
  Backlog --> In_Progress
  Backlog --> Resolved
  Backlog --> Closed
  Backlog --> Draft
  Backlog --> Reported
  Reported --> Open
  Reported --> In_Progress
  Reported --> Resolved
  Reported --> Closed
  Reported --> Backlog
```
