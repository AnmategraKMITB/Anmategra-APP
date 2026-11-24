# Penandatanganan rilis dengan Nadina

Workflow `.github/workflows/nadina-release.yml` menandatangani artefak rilis
`anmategra-<versi>.zip` memakai image `reletz/nadina` yang dikunci berdasarkan digest,
membuat SBOM CycloneDX, menandatangani SBOM tersebut, lalu memverifikasi keduanya
sebelum tahap deploy simulasi.

## Isi direktori ini

| Berkas             | Keterangan                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `trust.json`       | Trust store (`minisign-trust/v1`) berisi tiga kunci publik demo yang diizinkan menandatangani paket `anmategra`. |
| `trust-empty.json` | Trust store kosong untuk menguji penolakan.                                                                      |
| `keys/*.pub.pem`   | Kunci publik demo per profil, dipakai untuk menurunkan isi `trust.json`.                                         |

Kunci privat tidak pernah berada di repositori. Kunci privat hanya ada sebagai secret
environment `nadina-release`.

## Fingerprint kunci demo

| Profil              | keyid                                                              |
| ------------------- | ------------------------------------------------------------------ |
| `rsa-pss-sha256`    | `6ff16bb96606b0d9724e2c9be3b592fd6715bb3fabde49b8b0cc81c2b946ef5f` |
| `ecdsa-p256-sha256` | `80c341a7a66145069025de3a42afc6c677c8dccecac24b05d9e70d9415fc5474` |
| `ed25519`           | `f54708671434b463e3e46afa7cd1517ba34045705e1a3244dd3976b1952ddbfa` |

Perubahan `trust.json` harus lewat review, karena isinya menentukan kunci mana yang
dipercaya. Workflow tidak pernah membuat atau mengubah trust store.

## Secret dan variabel

Secret berikut dipasang pada environment GitHub `nadina-release`:

| Nama                    | Isi                                                        |
| ----------------------- | ---------------------------------------------------------- |
| `NADINA_KEY_RSA_PSS`    | Kunci privat PEM untuk profil `rsa-pss-sha256`.            |
| `NADINA_KEY_ECDSA_P256` | Kunci privat PEM untuk profil `ecdsa-p256-sha256`.         |
| `NADINA_KEY_ED25519`    | Kunci privat PEM untuk profil `ed25519`.                   |
| `DOCKER_USERNAME`       | Akun Docker Hub.                                           |
| `DOCKER_PULL_TOKEN`     | Token read-only untuk menarik image.                       |
| `DOCKER_PUSH_TOKEN`     | Token read-write, hanya dipakai alur rilis nadina sendiri. |

`DOCKER_PULL_TOKEN` hanya dipakai bila diisi. Image `reletz/nadina` bersifat publik,
sehingga penarikan tanpa kredensial tetap berhasil dan token bersifat opsional
(misalnya untuk menghindari batas laju Docker Hub).

Memasang secret:

```sh
gh secret set NADINA_KEY_RSA_PSS --env nadina-release < rsa-pss-sha256.key.pem
gh secret set NADINA_KEY_ECDSA_P256 --env nadina-release < ecdsa-p256-sha256.key.pem
gh secret set NADINA_KEY_ED25519 --env nadina-release < ed25519.key.pem
gh secret set DOCKER_USERNAME --env nadina-release --body "<akun>"
gh secret set DOCKER_PULL_TOKEN --env nadina-release --body "<token-read-only>"
```

## Menjalankan

```sh
gh workflow run nadina-release.yml -f version=1.0.0 -f algorithm=ed25519
```

Workflow juga berjalan otomatis untuk tag `v*`. Versi diambil dari nama tag dengan
awalan `v` dibuang.

## Keluaran

Setiap run mengunggah artifact `nadina-release-<versi>` berisi:

| Berkas                                         | Keterangan                                  |
| ---------------------------------------------- | ------------------------------------------- |
| `anmategra-<versi>.zip.sha256`                 | SHA-256 artefak.                            |
| `anmategra-<versi>.zip.cdx.json`               | SBOM CycloneDX dari Trivy.                  |
| `anmategra-<versi>.zip.bundle.json`            | Bundle tanda tangan artefak.                |
| `anmategra-<versi>.zip.sbom.json`              | Wrapper SBOM yang mengikat SBOM ke artefak. |
| `anmategra-<versi>.zip.sbom.bundle.json`       | Bundle tanda tangan wrapper SBOM.           |
| `anmategra-<versi>.zip.verification.json`      | Hasil `verify --json`.                      |
| `anmategra-<versi>.zip.sbom.verification.json` | Hasil `sbom verify --json`.                 |
| `image.txt`                                    | Referensi image beserta digest.             |
| `run-url.txt`                                  | Tautan run.                                 |
| `deployed.txt`                                 | Penanda deploy simulasi.                    |

Tahap deploy bergantung pada `needs: sign` tanpa `continue-on-error`, sehingga
kegagalan verifikasi menghentikan alur.
