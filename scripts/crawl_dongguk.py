from __future__ import annotations

import argparse
import html
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data" / "processed" / "web_index.json"
BASE_URL = "https://ipsi.dongguk.edu"


BOARD_TARGETS = [
    ("입학도우미 공지사항", "입학도우미", "공지사항", "/admission/html/counsel/notice.asp"),
    ("입학도우미 자료실", "입학도우미", "자료실", "/admission/html/counsel/data.asp"),
    ("수시 공지사항", "수시", "공지사항", "/admission/html/rolling/notice.asp"),
    ("수시 자료실", "수시", "자료실", "/admission/html/rolling/data.asp"),
    ("정시 공지사항", "정시", "공지사항", "/admission/html/regular/notice.asp"),
    ("정시 자료실", "정시", "자료실", "/admission/html/regular/data.asp"),
    ("재외국민 공지사항", "재외국민/외국인", "공지사항", "/admission/html/abroad/notice.asp"),
    ("재외국민 자료실", "재외국민/외국인", "자료실", "/admission/html/abroad/data.asp"),
    ("편입학 공지사항", "편입", "공지사항", "/admission/html/transfer/notice.asp"),
    ("편입학 자료실", "편입", "자료실", "/admission/html/transfer/data.asp"),
    ("고교동국연계 공지사항", "고교동국연계", "공지사항", "/admission/html/ties/notice.asp"),
]

STATIC_TARGETS = [
    ("입시결과", "입학도우미", "입시결과", "/admission/html/counsel/previous.asp"),
    ("FAQ", "입학도우미", "FAQ", "/admission/html/counsel/faq.asp"),
    ("고교동국연계 프로그램 운영일정", "고교동국연계", "프로그램", "/admission/html/ties/explanation.asp"),
    ("고교동국연계 프로그램", "고교동국연계", "프로그램", "/admission/html/ties/ties.asp"),
    ("교사간담회", "고교동국연계", "프로그램", "/admission/html/ties/presentation.asp"),
]


def fetch_text(url: str, timeout: int = 20) -> str:
    request = Request(
        url,
        headers={
            "User-Agent": "DonggukAdmissionsCounselingAssistant/0.1 (+internal admissions office use)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        body = response.read()
        content_type = response.headers.get("content-type", "")
    encoding = "euc-kr" if "euc-kr" in content_type.lower() else "utf-8"
    return body.decode(encoding, errors="replace")


def strip_html(value: str) -> str:
    value = re.sub(r"data:image/[^\"')\s]+", " ", value, flags=re.I)
    value = re.sub(r"<script\b.*?</script>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<style\b.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<br\s*/?>", "\n", value, flags=re.I)
    value = re.sub(r"</(p|div|li|tr|dt|dd|h\d)>", "\n", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    value = html.unescape(value)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def infer_year(*values: str) -> str:
    for value in values:
        match = re.search(r"(20\d{2})학년도", value or "")
        if match:
            return match.group(1)
    return "확인 필요"


def normalize_url(path_or_url: str, base_url: str = BASE_URL) -> str:
    if path_or_url.startswith("//"):
        return f"https:{path_or_url}"
    return urljoin(base_url, path_or_url)


def detail_path_for(list_path: str) -> str:
    if list_path.endswith("data.asp"):
        return list_path.replace("data.asp", "dataView.asp")
    if list_path.endswith("notice.asp"):
        return list_path.replace("notice.asp", "noticeView.asp")
    return list_path


def extract_board_rows(page_html: str) -> Iterable[dict[str, str]]:
    tbody_match = re.search(r"<table[^>]*class=[\"']bList[\"'][^>]*>.*?<tbody>(.*?)</tbody>", page_html, re.I | re.S)
    if not tbody_match:
        return []

    rows = re.findall(r"<tr\b[^>]*>(.*?)</tr>", tbody_match.group(1), re.I | re.S)
    items = []
    for row in rows:
        idx_match = re.search(r"viewData\(['\"](\d+)['\"]\)", row)
        title_match = re.search(r"<dt>.*?<a\b[^>]*>.*?<span[^>]*>(.*?)</span>.*?</a>.*?</dt>", row, re.I | re.S)
        if not idx_match or not title_match:
            continue

        category_match = re.search(r"모집시기\s*:\s*<span[^>]*>(.*?)</span>", row, re.I | re.S)
        date_match = re.search(r"작성일\s*:\s*([0-9.]+)", row)
        attachment_names = re.findall(r"<img\b[^>]*alt=[\"']([^\"']+)[\"']", row, re.I)
        items.append(
            {
                "board_idx": idx_match.group(1),
                "title": strip_html(title_match.group(1)),
                "category": strip_html(category_match.group(1)) if category_match else "",
                "published_date": date_match.group(1) if date_match else "",
                "attachments": [strip_html(name) for name in attachment_names if strip_html(name)],
            }
        )
    return items


def extract_detail_content(page_html: str) -> tuple[str, str, list[str]]:
    title_match = re.search(r"<p[^>]*class=[\"']bView-tit[\"'][^>]*>(.*?)</p>", page_html, re.I | re.S)
    content_match = re.search(r"<div[^>]*class=[\"']bView[\"'][^>]*>(.*?)</div>\s*<div[^>]*class=[\"']bControl", page_html, re.I | re.S)
    if not content_match:
        content_match = re.search(r"<div[^>]*class=[\"']bView[\"'][^>]*>(.*?)</div>", page_html, re.I | re.S)
    attachment_names = re.findall(r"<a\b[^>]*href=[\"'][^\"']+[\"'][^>]*>(.*?)</a>", page_html, re.I | re.S)
    title = strip_html(title_match.group(1)) if title_match else ""
    content = strip_html(content_match.group(1)) if content_match else ""
    attachments = [strip_html(name) for name in attachment_names if strip_html(name)]
    return title, content, attachments


def split_text(text: str, max_chars: int = 900) -> list[str]:
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


def crawl_board_target(target: tuple[str, str, str, str], max_items: int, delay: float) -> tuple[list[dict], list[dict]]:
    label, recruitment_type, source_type, path = target
    list_url = normalize_url(path)
    page_html = fetch_text(list_url)
    rows = list(extract_board_rows(page_html))[:max_items]
    documents = []
    chunks = []

    for row in rows:
        detail_path = detail_path_for(path)
        detail_url = f"{normalize_url(detail_path)}?BOARD_IDX={row['board_idx']}"
        try:
            detail_html = fetch_text(detail_url)
            detail_title, detail_content, detail_attachments = extract_detail_content(detail_html)
        except Exception as error:
            detail_title = ""
            detail_content = f"상세 페이지 수집 실패: {error}"
            detail_attachments = []

        title = detail_title or row["title"]
        attachments = list(dict.fromkeys(row["attachments"] + detail_attachments))
        content = "\n".join(
            value
            for value in [
                title,
                f"모집시기: {row['category']}" if row["category"] else "",
                f"작성일: {row['published_date']}" if row["published_date"] else "",
                f"첨부파일: {', '.join(attachments)}" if attachments else "",
                detail_content,
            ]
            if value
        )

        document_id = f"web_{row['board_idx']}"
        document = {
            "document_id": document_id,
            "title": title,
            "source_type": source_type,
            "source_area": label,
            "admission_year": infer_year(title, detail_content),
            "recruitment_type": recruitment_type if recruitment_type != "입학도우미" else (row["category"] or "공통"),
            "published_date": row["published_date"],
            "source_url": detail_url,
            "attachments": attachments,
        }
        documents.append(document)
        for chunk_number, chunk_text in enumerate(split_text(content), start=1):
            chunks.append(
                {
                    **document,
                    "chunk_id": f"{document_id}_{chunk_number}",
                    "section": "웹 공지 본문",
                    "page": None,
                    "page_url": detail_url,
                    "content": chunk_text,
                }
            )
        time.sleep(delay)
    return documents, chunks


def crawl_static_target(target: tuple[str, str, str, str]) -> tuple[dict, list[dict]]:
    title, recruitment_type, source_type, path = target
    url = normalize_url(path)
    page_html = fetch_text(url)
    content = strip_html(page_html)
    parsed_path = urlparse(url).path.strip("/").replace("/", "_").replace(".", "_")
    document_id = f"web_{parsed_path}"
    document = {
        "document_id": document_id,
        "title": title,
        "source_type": source_type,
        "source_area": title,
        "admission_year": infer_year(title, content),
        "recruitment_type": recruitment_type,
        "published_date": "",
        "source_url": url,
        "attachments": [],
    }
    chunks = [
        {
            **document,
            "chunk_id": f"{document_id}_{chunk_number}",
            "section": "웹 페이지 본문",
            "page": None,
            "page_url": url,
            "content": chunk_text,
        }
        for chunk_number, chunk_text in enumerate(split_text(content), start=1)
    ]
    return document, chunks


def build_index(max_items: int, delay: float) -> dict:
    generated_at = datetime.now(timezone.utc).isoformat()
    documents = []
    chunks = []
    seen_documents = set()

    for target in BOARD_TARGETS:
        target_documents, target_chunks = crawl_board_target(target, max_items=max_items, delay=delay)
        for document in target_documents:
            if document["document_id"] in seen_documents:
                continue
            seen_documents.add(document["document_id"])
            documents.append(document)
        chunks.extend(target_chunks)

    for target in STATIC_TARGETS:
        document, target_chunks = crawl_static_target(target)
        if document["document_id"] not in seen_documents:
            seen_documents.add(document["document_id"])
            documents.append(document)
        chunks.extend(target_chunks)
        time.sleep(delay)

    return {
        "generated_at": generated_at,
        "source": BASE_URL,
        "document_count": len(documents),
        "chunk_count": len(chunks),
        "documents": documents,
        "chunks": chunks,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Crawl Dongguk admissions public pages into a local search index.")
    parser.add_argument("--max-items", type=int, default=8, help="Number of latest board rows to collect from each board.")
    parser.add_argument("--delay", type=float, default=0.3, help="Delay between detail requests in seconds.")
    args = parser.parse_args()

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    index = build_index(max_items=args.max_items, delay=args.delay)
    OUTPUT_PATH.write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Indexed {index['document_count']} web documents, {index['chunk_count']} chunks -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
