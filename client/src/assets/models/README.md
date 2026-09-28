# Model deteksi wajah

`face_landmarker.task` dipakai untuk verifikasi wajah + kedip saat absen di web (Tahap 3).

| | |
| --- | --- |
| Sumber | https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task |
| Pembuat | Google MediaPipe |
| Lisensi | Apache License 2.0 |
| Ukuran | 3.758.596 byte |
| SHA-256 | `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff` |

File ini disimpan di repo (bukan dimuat dari CDN) supaya absen tidak bergantung pada layanan luar. Runtime WASM-nya berasal dari paket npm `@mediapipe/tasks-vision` dan ikut dibundel Vite.
