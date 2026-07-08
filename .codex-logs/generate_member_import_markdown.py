import datetime as dt
import hashlib
import json
import re
import sys
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pkgrel": "http://schemas.openxmlformats.org/package/2006/relationships",
}

EXCEL_EPOCH = dt.date(1899, 12, 30)


def entry_bytes(zf, name):
    with zf.open(name) as fh:
        return fh.read()


def shared_strings(zf):
    try:
        root = ET.fromstring(entry_bytes(zf, "xl/sharedStrings.xml"))
    except KeyError:
        return []

    values = []
    for si in root.findall("main:si", NS):
        values.append("".join(node.text or "" for node in si.findall(".//main:t", NS)))
    return values


def col_to_index(cell_ref):
    match = re.match(r"([A-Z]+)", cell_ref or "")
    if not match:
        return 0
    index = 0
    for ch in match.group(1):
        index = index * 26 + (ord(ch) - ord("A") + 1)
    return index - 1


def cell_value(cell, shared):
    cell_type = cell.attrib.get("t")
    if cell_type == "inlineStr":
        return "".join(node.text or "" for node in cell.findall(".//main:t", NS)).strip()

    value = cell.find("main:v", NS)
    if value is None:
        return ""

    text = (value.text or "").strip()
    if cell_type == "s":
        try:
            return shared[int(text)].strip()
        except (ValueError, IndexError):
            return text
    return text


def get_sheet_target(zf, sheet_name):
    workbook = ET.fromstring(entry_bytes(zf, "xl/workbook.xml"))
    rels = ET.fromstring(entry_bytes(zf, "xl/_rels/workbook.xml.rels"))
    rel_by_id = {
        rel.attrib["Id"]: rel.attrib["Target"]
        for rel in rels.findall("pkgrel:Relationship", NS)
    }

    for sheet in workbook.findall(".//main:sheets/main:sheet", NS):
        if sheet.attrib.get("name") == sheet_name:
            rel_id = sheet.attrib.get(f"{{{NS['rel']}}}id")
            return "xl/" + rel_by_id[rel_id].lstrip("/")
    raise RuntimeError(f"Sheet not found: {sheet_name}")


def read_sheet_rows(xlsx_path, sheet_name):
    with zipfile.ZipFile(xlsx_path) as zf:
        shared = shared_strings(zf)
        root = ET.fromstring(entry_bytes(zf, get_sheet_target(zf, sheet_name)))
        rows = []
        for row in root.findall(".//main:sheetData/main:row", NS):
            row_index = int(row.attrib.get("r", "0"))
            values = {}
            for cell in row.findall("main:c", NS):
                values[col_to_index(cell.attrib.get("r", ""))] = cell_value(cell, shared)
            rows.append((row_index, values))
        return rows


def clean_name(value):
    return re.sub(r"\s+", " ", (value or "").strip())


def normalize_name(value):
    return clean_name(value).casefold()


def normalize_identity(value):
    text = (value or "").strip()
    if text.endswith(".0"):
        text = text[:-2]
    if text in {"-", "0", "null", "NULL", "N/A", "n/a"}:
        return ""
    return text


def excel_date_to_iso(value):
    raw = (value or "").strip()
    if not raw:
        return ""

    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        return raw

    try:
        serial = float(raw)
    except ValueError:
        return raw

    if serial < 1 or serial > 80000:
        return raw

    date_value = EXCEL_EPOCH + dt.timedelta(days=int(serial))
    return date_value.isoformat()


def birth_date_digits_from_nik(nik):
    text = re.sub(r"\D", "", nik or "")
    if len(text) != 16:
        return ""

    try:
        day = int(text[6:8])
        month = int(text[8:10])
        year_two_digits = int(text[10:12])
    except ValueError:
        return ""

    if day > 40:
        day -= 40

    current_year_two_digits = dt.date.today().year % 100
    year = 2000 + year_two_digits if year_two_digits <= current_year_two_digits else 1900 + year_two_digits

    try:
        dt.date(year, month, day)
    except ValueError:
        return ""

    return f"{day:02d}{month:02d}{year % 100:02d}"


def birth_date_digits_for_username(value, nik):
    raw = (value or "").strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw):
        year, month, day = raw.split("-")
        return f"{day}{month}{year[-2:]}"

    nik_digits = birth_date_digits_from_nik(nik)
    if nik_digits:
        return nik_digits

    if not raw:
        return ""

    date_match = re.search(r"(\d{1,2})\D+(\d{1,2})\D+(\d{2,4})", raw)
    if date_match:
        day, month, year = date_match.groups()
        return f"{int(day):02d}{int(month):02d}{year[-2:]}"

    digits = re.sub(r"\D", "", raw)
    if len(digits) >= 8:
        return f"{digits[:2]}{digits[2:4]}{digits[-2:]}"

    return digits[:6]


def username_candidates_from_name(name, birth_date, nik, fallback_number):
    text = unicodedata.normalize("NFKD", name or "").encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    tokens = [token for token in text.split() if token]

    honorifics = {
        "dr",
        "drg",
        "drs",
        "dra",
        "ir",
        "h",
        "hj",
        "tn",
        "ny",
        "mrs",
        "mr",
    }
    while tokens and tokens[0] in honorifics:
        tokens.pop(0)

    while len(tokens) >= 2 and len(tokens[0]) == 1:
        tokens.pop(0)

    if not tokens:
        return [f"member.raho.{fallback_number}"]

    first_name = tokens[0]
    birth_digits = birth_date_digits_for_username(birth_date, nik)

    if birth_digits:
        candidates = [f"{first_name}{birth_digits}"]

        if len(tokens) >= 2:
            candidates.append(f"{first_name}.{tokens[-1]}{birth_digits}")
            candidates.append(f"{first_name}.{tokens[1]}{birth_digits}")

        if len(tokens) >= 3:
            candidates.append(f"{first_name}.{tokens[1]}.{tokens[-1]}{birth_digits}")
    else:
        candidates = [first_name]

        if len(tokens) >= 2:
            candidates.append(f"{first_name}.{tokens[-1]}")
            candidates.append(f"{first_name}.{tokens[1]}")

        if len(tokens) >= 3:
            candidates.append(f"{first_name}.{tokens[1]}.{tokens[-1]}")

    normalized = []
    for candidate in candidates:
        username = candidate[:30].strip(".-_")
        if not birth_digits and len(username) < 4:
            username = f"{username}.raho"
        if username and username not in normalized:
            normalized.append(username)

    return normalized or [f"member.raho.{fallback_number}"]


def unique_username(candidates, used):
    for candidate in candidates:
        candidate = candidate[:30].strip(".-_")
        if candidate not in used:
            used.add(candidate)
            return candidate

    base = candidates[0][:30].strip(".-_")
    suffix_number = 2
    candidate = base
    while candidate in used:
        suffix = f".{suffix_number}"
        candidate = f"{base[:30 - len(suffix)].strip('.-_')}{suffix}"
        suffix_number += 1

    used.add(candidate)
    return candidate


def initial_password(member):
    seed = "|".join(
        [
            member["kode_member_excel"],
            member["nama_lengkap"],
            member["nik"],
            member["tanggal_lahir"],
        ]
    )
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()[:8]
    return f"Raho@{digest}"


def md_escape(value):
    text = str(value or "")
    return text.replace("\\", "\\\\").replace("|", "\\|").replace("\n", " ").strip()


def rows_to_members(rows):
    header_row = next(values for row_index, values in rows if row_index == 5)
    headers = {idx: value.replace(" *", "").strip() for idx, value in header_row.items()}
    members = []

    for row_index, values in rows:
        if row_index <= 5:
            continue
        raw = {headers.get(idx, f"Column {idx + 1}"): value for idx, value in values.items()}
        code = raw.get("Kode Member Excel", "").strip()
        name = clean_name(raw.get("Nama Lengkap", ""))
        if not code and not name:
            continue

        member = {
            "no": len(members) + 1,
            "row": row_index,
            "kode_member_excel": code,
            "nama_lengkap": name,
            "email": raw.get("Email", "").strip(),
            "phone": raw.get("No HP/WA", "").strip(),
            "nik": normalize_identity(raw.get("NIK", "")),
            "jenis_kelamin": raw.get("Jenis Kelamin", "").strip(),
            "tempat_lahir": clean_name(raw.get("Tempat Lahir", "")),
            "tanggal_lahir": excel_date_to_iso(raw.get("Tanggal Lahir", "")),
            "agama": raw.get("Agama", "").strip(),
            "alamat": clean_name(raw.get("Alamat Lengkap", "")),
            "kode_pos": raw.get("Kode Pos", "").strip(),
            "pekerjaan": clean_name(raw.get("Pekerjaan", "")),
            "status_nikah": raw.get("Status Nikah", "").strip(),
            "kontak_darurat": clean_name(raw.get("Kontak Darurat", "")),
            "sumber_info_raho": raw.get("Sumber Info RAHO", "").strip(),
            "cabang_registrasi": raw.get("Cabang Registrasi", "").strip(),
            "kode_referral": raw.get("Kode Referral", "").strip(),
            "setuju_foto": raw.get("Setuju Foto?", "").strip(),
            "catatan_member": clean_name(raw.get("Catatan Member", "")),
        }
        member["password_awal"] = initial_password(member)
        members.append(member)

    used_usernames = set()
    for member in members:
        candidates = username_candidates_from_name(
            member["nama_lengkap"],
            member["tanggal_lahir"],
            member["nik"],
            member["no"],
        )
        member["username"] = unique_username(candidates, used_usernames)

    return members


def duplicates(members, key_fn):
    groups = {}
    for member in members:
        key = key_fn(member)
        if not key:
            continue
        groups.setdefault(key, []).append(member)
    return {key: items for key, items in groups.items() if len(items) > 1}


def is_iso_date(value):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value or ""):
        return False
    try:
        dt.date.fromisoformat(value)
        return True
    except ValueError:
        return False


def is_valid_nik(value):
    return bool(re.fullmatch(r"\d{16}", value or ""))


def member_review_notes(member, duplicate_nik_keys, duplicate_name_dob_keys):
    notes = []
    if not member["nik"]:
        notes.append("NIK kosong")
    elif not is_valid_nik(member["nik"]):
        notes.append("Review NIK")

    if not member["tanggal_lahir"]:
        notes.append("Tanggal lahir kosong")
    elif not is_iso_date(member["tanggal_lahir"]):
        notes.append("Review tanggal lahir")

    if member["nik"] and member["nik"] in duplicate_nik_keys:
        notes.append("Duplikat NIK di Excel")

    name_dob_key = (normalize_name(member["nama_lengkap"]), member["tanggal_lahir"])
    if member["tanggal_lahir"] and name_dob_key in duplicate_name_dob_keys:
        notes.append("Duplikat nama+tgl di Excel")

    if notes:
        return "; ".join(notes)
    return "Siap cek DB"


def build_markdown(source_path, members):
    generated_at = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    duplicate_nik = duplicates(members, lambda m: m["nik"])
    duplicate_name_dob = duplicates(
        members,
        lambda m: (normalize_name(m["nama_lengkap"]), m["tanggal_lahir"]) if m["tanggal_lahir"] else None,
    )
    missing_birth_date = [m for m in members if not m["tanggal_lahir"]]
    missing_nik = [m for m in members if not m["nik"]]
    invalid_birth_date = [m for m in members if m["tanggal_lahir"] and not is_iso_date(m["tanggal_lahir"])]
    invalid_nik = [m for m in members if m["nik"] and not is_valid_nik(m["nik"])]
    duplicate_nik_keys = set(duplicate_nik.keys())
    duplicate_name_dob_keys = set(duplicate_name_dob.keys())

    lines = [
        "# Import Member RAHO dari Excel",
        "",
        f"Sumber data: `{source_path}`",
        f"Dibuat: `{generated_at}`",
        f"Total member pada sheet `01 Member`: **{len(members)}**",
        "",
        "> PERHATIAN: File ini berisi password awal dalam bentuk plaintext. Jangan commit ke repository publik, jangan kirim ke grup umum, dan segera reset/ganti password setelah import atau saat member pertama login.",
        "",
        "## Ringkasan Credential",
        "",
        "- Username awal dibuat dari nama awal/nama depan member + digit tanggal lahir format pendek `DDMMYY`, contoh `SUPRANTO BUDI` dengan tanggal lahir `1960-04-11` menjadi `supranto110460`.",
        "- Gelar umum seperti `dr`, `drg`, `drs`, `ir`, `h`, `hj`, `tn`, dan `ny` tidak dipakai di username agar lebih pendek dan mudah diingat.",
        "- Jika tanggal lahir Excel kosong/tidak valid tetapi NIK valid, digit tanggal lahir diambil dari NIK.",
        "- Jika tanggal lahir dan NIK tidak bisa dipakai, username memakai nama awal/variasi nama tanpa kode member.",
        "- Jika username bentrok, sistem mencoba variasi nama tanpa kode member, lalu angka kecil hanya jika masih benar-benar sama.",
        "- Password awal dibuat deterministik dari kode member, nama, NIK, dan tanggal lahir agar daftar bisa diregenerasi konsisten.",
        "- Di aplikasi saat ini username member disimpan di kolom database `users.email`, walaupun secara UI disebut `Username Login`.",
        "- Password tidak bisa dilihat kembali setelah member dibuat karena disimpan sebagai hash. Jika member sudah ada dan password tidak diketahui, lakukan reset password.",
        "",
        "## Hasil Validasi Awal dari Excel",
        "",
        f"- Duplikat NIK di Excel: **{len(duplicate_nik)} grup**.",
        f"- Duplikat nama + tanggal lahir di Excel: **{len(duplicate_name_dob)} grup**.",
        f"- Baris tanpa NIK: **{len(missing_nik)} member**.",
        f"- Baris dengan NIK tidak 16 digit: **{len(invalid_nik)} member**.",
        f"- Baris tanpa tanggal lahir: **{len(missing_birth_date)} member**.",
        f"- Baris dengan tanggal lahir perlu review: **{len(invalid_birth_date)} member**.",
        "",
        "## Aturan Cek Apakah Member Sudah Ada",
        "",
        "Gunakan urutan ini sebelum membuat member baru:",
        "",
        "1. Cek `nik` secara exact match. Jika NIK sudah ada, anggap member sudah terdaftar.",
        "2. Jika NIK kosong atau meragukan, cek kombinasi `nama_lengkap` yang sudah dinormalisasi + `tanggal_lahir`.",
        "3. Jika NIK cocok tetapi nama/tanggal lahir berbeda, jangan import otomatis. Masukkan ke daftar review manual.",
        "4. Jika nama + tanggal lahir cocok tetapi NIK berbeda, jangan membuat member baru sebelum verifikasi manual.",
        "5. Jika tidak ada match NIK dan tidak ada match nama + tanggal lahir, buat member baru dengan credential pada tabel di bawah.",
        "",
        "## SQL Cek Duplikat per Member",
        "",
        "Gunakan query ini untuk mengecek satu member sebelum import. Ganti parameter `:nik`, `:full_name`, dan `:birth_date`.",
        "",
        "```sql",
        "SELECT",
        "  m.id AS member_id,",
        "  m.\"memberNo\" AS member_no,",
        "  u.email AS username_login,",
        "  up.\"fullName\" AS full_name,",
        "  m.nik,",
        "  m.\"dateOfBirth\"::date AS date_of_birth,",
        "  b.name AS registration_branch,",
        "  m.\"isActive\" AS is_active",
        "FROM members m",
        "JOIN users u ON u.id = m.\"userId\"",
        "JOIN user_profiles up ON up.\"userId\" = u.id",
        "LEFT JOIN branches b ON b.id = m.\"registrationBranchId\"",
        "WHERE",
        "  (:nik IS NOT NULL AND :nik <> '' AND m.nik = :nik)",
        "  OR (",
        "    lower(regexp_replace(trim(up.\"fullName\"), '\\s+', ' ', 'g')) =",
        "      lower(regexp_replace(trim(:full_name), '\\s+', ' ', 'g'))",
        "    AND m.\"dateOfBirth\"::date = :birth_date::date",
        "  );",
        "```",
        "",
        "## Jika Data Member Sudah Terbuat",
        "",
        "| Kondisi | Tindakan |",
        "|---|---|",
        "| NIK sama, nama dan tanggal lahir sama | Jangan buat member baru. Update field yang kosong/kurang, lalu catat mapping `Kode Member Excel` ke `memberId/memberNo` yang sudah ada. |",
        "| NIK sama, nama atau tanggal lahir beda | Tahan import. Review manual karena bisa salah input NIK atau data lama tidak lengkap. |",
        "| NIK kosong, nama + tanggal lahir sama | Jangan buat member baru dulu. Review manual, lalu update member existing jika benar orang yang sama. |",
        "| Nama sama, tanggal lahir beda | Boleh jadi orang berbeda. Jangan merge otomatis. |",
        "| Member existing tetapi username berbeda | Gunakan menu credential Super Admin untuk update username, atau pertahankan username lama dan simpan mapping Excel. |",
        "| Member existing tetapi password tidak diketahui | Reset password melalui menu credential/API reset password, lalu gunakan password awal dari tabel ini atau password baru yang disepakati. |",
        "| Data belum ada | Buat member baru memakai data Excel dan credential awal dari tabel ini. |",
        "",
        "## Field yang Perlu Diisi Saat Import",
        "",
        "| Excel | Field aplikasi/database | Catatan |",
        "|---|---|---|",
        "| Kode Member Excel | external import ref / mapping import | Jangan mengganti `memberNo` database tanpa keputusan khusus. |",
        "| Nama Lengkap | `user_profiles.fullName` | Wajib. Normalize spasi. |",
        "| Email | opsional | Aplikasi login member memakai username, bukan email asli. |",
        "| No HP/WA | `user_profiles.phone` | Banyak data Excel kosong; import lama perlu toleran. |",
        "| NIK | `members.nik` | Exact duplicate key utama. |",
        "| Jenis Kelamin | `members.jenisKelamin` | Map `Laki-laki` -> `L`, `Perempuan` -> `P`. |",
        "| Tempat Lahir | `members.tempatLahir` | Opsional di Excel. |",
        "| Tanggal Lahir | `members.dateOfBirth` | Excel serial sudah dikonversi menjadi `YYYY-MM-DD`. |",
        "| Agama | `members.agama` | Opsional. |",
        "| Alamat Lengkap | `members.address` | Opsional. |",
        "| Kode Pos | `members.postalCode` | Opsional. |",
        "| Pekerjaan | `members.pekerjaan` | Opsional. |",
        "| Status Nikah | `members.statusNikah` | Opsional. |",
        "| Kontak Darurat | `members.emergencyContact` | Jika ada nomor terpisah di masa depan, simpan konsisten. |",
        "| Sumber Info RAHO | `members.sumberInfoRaho` | Opsional. |",
        "| Cabang Registrasi | `members.registrationBranchId` | Harus dimapping ke tabel `branches`. |",
        "| Kode Referral | `members.referralCodeId` | Cari referral aktif berdasarkan kode. |",
        "| Setuju Foto? | `members.isConsentToPhoto` | Kosong perlu default yang disepakati. |",
        "| Catatan Member | belum ada field khusus | Saran tambah `members.notes` atau simpan pada import log. |",
        "",
        "## Daftar Username dan Password Awal",
        "",
        "| No | Row Excel | Kode Member Excel | Nama Lengkap | Tanggal Lahir | NIK | Cabang Registrasi | Username | Password Awal | Status Cek | Tindakan |",
        "|---:|---:|---|---|---|---|---|---|---|---|---|",
    ]

    for member in members:
        lines.append(
            "| "
            + " | ".join(
                [
                    str(member["no"]),
                    str(member["row"]),
                    md_escape(member["kode_member_excel"]),
                    md_escape(member["nama_lengkap"]),
                    md_escape(member["tanggal_lahir"]),
                    md_escape(member["nik"]),
                    md_escape(member["cabang_registrasi"]),
                    f"`{md_escape(member['username'])}`",
                    f"`{md_escape(member['password_awal'])}`",
                    md_escape(member_review_notes(member, duplicate_nik_keys, duplicate_name_dob_keys)),
                    "Cek NIK -> cek nama+tanggal lahir -> create/update",
                ]
            )
            + " |"
        )

    if duplicate_nik or duplicate_name_dob:
        lines.extend(["", "## Catatan Duplikat Internal Excel", ""])
        if duplicate_nik:
            lines.append("### Duplikat NIK")
            lines.append("")
            for nik, items in duplicate_nik.items():
                names = ", ".join(f"{m['kode_member_excel']} - {m['nama_lengkap']}" for m in items)
                lines.append(f"- `{nik}`: {names}")
            lines.append("")
        if duplicate_name_dob:
            lines.append("### Duplikat Nama + Tanggal Lahir")
            lines.append("")
            for (name, birth_date), items in duplicate_name_dob.items():
                names = ", ".join(f"{m['kode_member_excel']} - {m['nama_lengkap']}" for m in items)
                lines.append(f"- `{name}` / `{birth_date}`: {names}")

    return "\n".join(lines) + "\n"


def main():
    source_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    rows = read_sheet_rows(source_path, "01 Member")
    members = rows_to_members(rows)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(build_markdown(source_path, members), encoding="utf-8")
    print(json.dumps({"output": str(output_path), "members": len(members)}, indent=2))


if __name__ == "__main__":
    main()
