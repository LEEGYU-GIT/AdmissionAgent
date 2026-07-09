from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
RAW_PDF_DIR = ROOT / "data" / "raw_pdfs"
OUTPUT_PATH = ROOT / "data" / "processed" / "pdf_index.json"


def normalize_text(value: str) -> str:
    value = re.sub(r"\s+", " ", value or "")
    return value.strip()


def infer_metadata(filename: str) -> dict[str, str]:
    compact = re.sub(r"\s+", "", filename)
    year_match = re.search(r"(20\d{2})학년도", compact)
    year = year_match.group(1) if year_match else "확인 필요"

    if "수시" in compact:
        recruitment_type = "수시"
    elif "정시" in compact:
        recruitment_type = "정시"
    elif "편입" in compact:
        recruitment_type = "편입"
    elif "재외국민" in compact or "외국인" in compact:
        recruitment_type = "재외국민/외국인"
    else:
        recruitment_type = "확인 필요"

    if "모집요강" in compact:
        document_type = "모집요강"
    elif "소정서식" in compact or "서식" in compact or "추천서" in compact:
        document_type = "서식"
    else:
        document_type = "입학처 문서"

    return {
        "admission_year": year,
        "recruitment_type": recruitment_type,
        "document_type": document_type,
    }


def split_page_text(text: str, max_chars: int = 900) -> list[str]:
    if len(text) <= max_chars:
        return [text] if text else []

    sentences = re.split(r"(?<=[.?!。])\s+|(?<=다\.)\s+", text)
    chunks: list[str] = []
    current = ""

    for sentence in sentences:
        if not sentence:
            continue
        if len(current) + len(sentence) + 1 <= max_chars:
            current = f"{current} {sentence}".strip()
        else:
            if current:
                chunks.append(current)
            current = sentence[:max_chars]

    if current:
        chunks.append(current)

    return chunks


def build_index() -> dict:
    documents = []
    chunks = []
    generated_at = datetime.now(timezone.utc).isoformat()

    for pdf_path in sorted(RAW_PDF_DIR.glob("*.pdf")):
        metadata = infer_metadata(pdf_path.name)
        document_id = pdf_path.stem
        source_url = f"data/raw_pdfs/{pdf_path.name}"

        reader = PdfReader(str(pdf_path))
        documents.append(
            {
                "document_id": document_id,
                "title": pdf_path.name,
                "file_name": pdf_path.name,
                "source_url": source_url,
                "page_count": len(reader.pages),
                "indexed_at": generated_at,
                **metadata,
            }
        )

        for page_number, page in enumerate(reader.pages, start=1):
            text = normalize_text(page.extract_text() or "")
            for chunk_number, chunk_text in enumerate(split_page_text(text), start=1):
                chunks.append(
                    {
                        "chunk_id": f"{document_id}_p{page_number}_{chunk_number}",
                        "document_id": document_id,
                        "title": pdf_path.name,
                        "source_type": metadata["document_type"],
                        "admission_year": metadata["admission_year"],
                        "recruitment_type": metadata["recruitment_type"],
                        "page": page_number,
                        "section": "페이지 본문",
                        "source_url": source_url,
                        "page_url": f"{source_url}#page={page_number}",
                        "content": chunk_text,
                    }
                )

    return {
        "generated_at": generated_at,
        "document_count": len(documents),
        "chunk_count": len(chunks),
        "documents": documents,
        "chunks": chunks,
    }


def main() -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    index = build_index()
    OUTPUT_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        f"Indexed {index['document_count']} PDFs, "
        f"{index['chunk_count']} chunks -> {OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()
