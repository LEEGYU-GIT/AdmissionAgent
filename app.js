const sampleSources = [
  {
    title: "2026학년도 수시모집요강",
    type: "모집요강",
    year: "2026",
    recruitment: "수시",
    track: "학생부종합",
    page: 37,
    section: "학생부종합전형 지원자격",
    url: "public/sources/2026_susi_guide.pdf",
    quote: "지원자격은 전형별 세부 기준을 따르며, 지원자 유형에 따라 확인해야 할 제출서류가 다를 수 있습니다."
  },
  {
    title: "2026학년도 수시모집요강",
    type: "모집요강",
    year: "2026",
    recruitment: "수시",
    track: "학생부종합",
    page: 52,
    section: "지원자 유형별 제출서류",
    url: "public/sources/2026_susi_guide.pdf",
    quote: "검정고시 출신자 등 학교생활기록부 외 별도 확인이 필요한 지원자는 모집요강의 제출서류 안내를 확인해야 합니다."
  }
];

const state = {
  lastAnalysis: null,
  evidenceSources: []
};

const $ = (id) => document.getElementById(id);

const trackOptionsByRecruitment = {
  "수시": [
    "확인 필요",
    "학생부종합",
    "학생부교과",
    "논술",
    "실기/실적",
    "Do Dream",
    "불교추천인재",
    "기회균형통합",
    "학교장추천인재"
  ],
  "정시": [
    "확인 필요",
    "일반전형",
    "농어촌학생",
    "특성화고교졸업자",
    "기초생활수급자/차상위계층",
    "실기"
  ],
  "편입": [
    "확인 필요",
    "농어촌학생",
    "특성화고교졸업자",
    "기초생활수급자및차상위계층",
    "특성화고등을졸업한재직자",
    "의료인력 양성 관련학과 전문학사학위 소지자"
  ],
  "재외국민/외국인": [
    "확인 필요",
    "중고교과정국외이수자",
    "전교육과정국외이수자",
    "북한이탈주민",
    "외국인"
  ],
  "확인 필요": ["확인 필요"]
};

function populateTrackOptions(preferredValue = "") {
  const recruitment = $("recruitmentInput").value;
  const options = trackOptionsByRecruitment[recruitment] || trackOptionsByRecruitment["확인 필요"];
  const select = $("trackInput");
  $("trackLabel").textContent = recruitment === "편입" ? "세부 모집구분" : "세부 전형/유형";
  select.innerHTML = options.map((option) => `<option value="${option}">${option}</option>`).join("");

  if (preferredValue && options.includes(preferredValue)) {
    select.value = preferredValue;
  } else {
    select.value = "확인 필요";
  }
}

function updateTransferTypeVisibility(preferredValue = "") {
  const isTransfer = $("recruitmentInput").value === "편입";
  $("transferTypeField").classList.toggle("hidden", !isTransfer);
  $("transferTypeInput").disabled = !isTransfer;

  if (!isTransfer) {
    $("transferTypeInput").value = "확인 필요";
    return;
  }

  if (preferredValue && ["일반편입학", "학사편입학"].includes(preferredValue)) {
    $("transferTypeInput").value = preferredValue;
  }
}

function normalizeTrackValue(value) {
  return value === "확인 필요" ? "" : value;
}

function recruitmentLabel(value) {
  return value === "편입" ? "편입학" : value;
}

function transferTypeValue() {
  if ($("recruitmentInput").value !== "편입") return "";
  const value = $("transferTypeInput").value;
  return value === "확인 필요" ? "" : value;
}

function inferIntent(question) {
  const text = question.replace(/\s/g, "");
  if (/사유서|성적증명서|성적표|기말고사|중간고사|미산출|안나온|안나옴|학기결손|학기중복|조기졸업|월반|유급/.test(text)) return "제출서류";
  if (/검정고시|지원자격|자격|가능/.test(text)) return "지원자격";
  if (/서류|제출|증명서/.test(text)) return "제출서류";
  if (/일정|날짜|언제|마감|발표/.test(text)) return "전형일정";
  if (/면접|논술|실기|고사/.test(text)) return "면접/논술/실기";
  if (/충원|추가합격|예비/.test(text)) return "충원합격";
  if (/등록|납부|환불/.test(text)) return "등록/환불";
  if (/입결|성적|합격가능|등급/.test(text)) return "전년도 입시결과";
  return "일반 문의";
}

function inferRisk(intent, question) {
  const text = question.replace(/\s/g, "");
  if (/사유서|성적증명서|성적표|기말고사|미산출|안나온|안나옴|학기결손|서류미비|오제출|미제출/.test(text)) {
    return "high";
  }
  if (/불합격|위반|늦게|오제출|미제출|합격가능|가능성|이의신청|민원/.test(text)) {
    return "high";
  }
  if (["지원자격", "제출서류", "전형일정", "면접/논술/실기", "충원합격", "등록/환불", "전년도 입시결과"].includes(intent)) {
    return "medium";
  }
  return "low";
}

function buildFollowUps(intent, year, recruitment, track, question = "") {
  const common = [];
  if (!year || year === "확인 필요") common.push("지원하시려는 학년도는 몇 학년도인가요?");
  if (!recruitment || recruitment === "확인 필요") common.push("수시, 정시, 편입 등 어떤 모집을 말씀하시나요?");
  if (!track.trim()) common.push("지원하시려는 세부 전형명이 어떻게 되나요?");

  const text = question.replace(/\s/g, "");
  if (recruitment === "재외국민/외국인" && intent === "제출서류" && /사유서|성적|기말|고3|미산출|안나온|안나옴/.test(text)) {
    return [
      ...common,
      "지원 유형이 중고교과정국외이수자(3년 특례)가 맞나요?",
      "고3 1학기 성적증명서가 아직 발급되지 않은 상황인가요, 발급은 됐지만 기말고사 성적만 미반영된 상황인가요?",
      "학교에서 해당 성적의 산출 또는 발급 예정일을 안내받았나요?",
      "성적 미기재 사유가 학기결손, 학제차이, 조기졸업, 기타 중 어디에 가까운가요?"
    ].slice(0, 4);
  }

  const byIntent = {
    "지원자격": [
      "지원자 유형이 국내고, 검정고시, 외국고, 재외국민 중 어디에 해당하나요?",
      "해당 전형의 지원자격을 확인할 수 있도록 모집단위도 함께 알 수 있을까요?"
    ],
    "제출서류": [
      "지원자 유형과 세부 전형명을 먼저 확인해도 될까요?",
      "제출하려는 서류명이 무엇인지 확인해 주세요."
    ],
    "전형일정": [
      "확인하려는 일정이 원서접수, 서류제출, 고사일, 합격자 발표 중 무엇인가요?",
      "모집단위나 고사 대상 전형이 정해져 있나요?"
    ],
    "면접/논술/실기": [
      "확인하려는 고사 종류가 면접, 논술, 실기 중 무엇인가요?",
      "지원 모집단위와 세부 전형명을 알려주실 수 있나요?"
    ],
    "전년도 입시결과": [
      "확인하려는 모집단위와 전형명을 알려주실 수 있나요?",
      "전년도 입시결과는 참고자료이며 합격 가능성을 단정할 수 없다는 점을 안내해도 될까요?"
    ]
  };

  return [...common, ...(byIntent[intent] || ["문의와 관련된 학년도, 모집시기, 전형명을 먼저 확인해 주세요."])].slice(0, 4);
}

function buildAnswer(intent, risk, year, recruitment, track, transferType = "", question = "") {
  const context = `${year || "해당"}학년도 ${recruitmentLabel(recruitment) || "모집"}${transferType ? ` ${transferType}` : ""}${track ? ` ${track}` : ""}`;
  const text = question.replace(/\s/g, "");

  if (recruitment === "재외국민/외국인" && intent === "제출서류" && /사유서|성적증명서|성적표|기말고사|고3|미산출|안나온|안나옴/.test(text)) {
    return `${context}에서 고3 1학기 기말고사 성적이 아직 산출되지 않았다는 사유만으로 바로 "사유서를 반드시 제출한다"고 단정하면 위험합니다.\n먼저 성적증명서가 아직 미발급인지, 발급은 되었지만 일부 성적만 미반영인지, 학교가 추후 성적 산출/발급 예정일을 안내했는지 확인해야 합니다.\n모집요강에는 사유서 서식이 있고, 학기결손·학기중복·휴학·조기졸업·월반·유급·기타 등 사유를 적고 해당 사유에 대한 증빙자료를 반드시 첨부하도록 되어 있습니다. 따라서 이 문의는 사유서 제출 대상일 가능성이 있으나, p.48 사유서 서식과 제출서류 유의사항을 확인한 뒤 담당자 확인 후 안내하세요.`;
  }

  if (intent === "지원자격") {
    return `${context} 지원 가능 여부는 세부 전형/유형별 지원자격과 지원자 유형에 따라 달라질 수 있습니다.\n먼저 학년도, 모집구분, 세부 전형 또는 유형, 지원자 유형을 확인한 뒤 모집요강의 지원자격 및 제출서류 기준으로 안내드리는 것이 안전합니다.\n현재 단계에서는 "지원 가능"이라고 단정하지 말고, 근거 문서의 해당 페이지를 확인한 뒤 안내하세요.`;
  }
  if (intent === "전년도 입시결과") {
    return `전년도 입시결과는 참고자료로 안내할 수 있지만, 합격 가능성은 지원자 전체의 성적, 경쟁률, 평가 요소에 따라 달라져 단정적으로 답변하기 어렵습니다.\n공식 입시결과 자료의 모집단위와 전형명을 확인한 뒤 참고 범위로만 안내하세요.`;
  }
  if (risk === "high") {
    return `해당 문의는 불이익이나 민원으로 이어질 수 있는 고위험 문의입니다.\n공식 문서의 근거 페이지를 확인하고, 답변 전 담당자 확인이 필요하다고 안내하는 것이 안전합니다.`;
  }
  return `${context} 관련 문의는 공식 모집요강과 최신 공지사항 기준으로 안내해야 합니다.\n근거 문서의 페이지와 원문을 확인한 뒤, 확인된 범위에서만 보수적으로 답변하세요.`;
}

function buildCautions(intent, risk) {
  const cautions = ["답변 전 근거 문서명, 페이지, 섹션을 확인하세요."];
  if (risk === "high") cautions.push("고위험 문의이므로 확답하지 말고 담당자 확인 필요로 표시하세요.");
  if (intent === "제출서류") cautions.push("서류 예외 상황은 원서접수/서류제출 마감과 불이익에 연결될 수 있으므로 필요 서류를 단정하지 마세요.");
  if (intent === "지원자격") cautions.push("세부 전형명과 지원자 유형 확인 전에는 지원 가능 여부를 단정하지 마세요.");
  if (intent === "전년도 입시결과") cautions.push("입시결과는 참고자료이며 합격 가능성을 예측하지 마세요.");
  cautions.push("최신 공지사항이 모집요강을 정정했을 가능성이 있으면 최신 공지를 우선 확인하세요.");
  return cautions;
}

function pageUrl(source) {
  if (!source.page) return source.pageUrl || source.url;
  return source.pageUrl || `${source.url}#page=${source.page}`;
}

function safeHref(url) {
  return encodeURI(url);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function framePageUrl(source) {
  if (!source.page) return source.url;
  const separator = source.url.includes("?") ? "&" : "?";
  return `${source.url}${separator}viewerPage=${source.page}&viewerTs=${Date.now()}#page=${source.page}`;
}

function isPdfSource(source) {
  return source.sourceKind === "pdf" || /\.pdf($|[?#])/i.test(source.url || "");
}

function evidenceLabel(source) {
  const title = source.title || "";
  const text = `${source.section || ""} ${source.quote || ""}`.replace(/\s+/g, " ");
  if (!source.page || source.sourceKind === "web") {
    const prefix = source.type ? `${source.type} · ` : "";
    return `${prefix}${title}`.length > 34 ? `${prefix}${title}`.slice(0, 34) + "..." : `${prefix}${title || "웹 원문"}`;
  }
  const isOverseas = title.includes("재외국민") || text.includes("재외국민 특별전형");

  if (isOverseas) {
    if (text.includes("사 유 서") || text.includes("사유서")) return "사유서 서식/증빙자료 첨부";
    if (text.includes("제출서류 및 유의사항")) return "제출서류 및 유의사항";
    if (text.includes("서류제출 방법")) return "서류제출 방법";
    if (text.includes("서류제출 예시")) return "서류제출 예시";
    if (text.includes("학력조회동의서") || text.includes("성적증명서 진위")) return "학력조회동의서/성적증명서 진위 확인";
    if (text.includes("Part 2") && text.includes("전형방법") && text.includes("지원자격")) return "재외국민 특별전형 세부사항 목차";
    if (text.includes("장학제도")) return "재외국민 특별전형 장학제도";
    if (text.includes("자격인정 공통사항")) return "자격인정 공통사항";
    if (text.includes("전년대비 주요 변경사항")) return "전년대비 주요 변경사항";
    if (text.includes("중고교과정국외이수자") && text.includes("재학기간")) return "중고교과정국외이수자 재학기간 인정기준";
    if (text.includes("전교육과정국외이수자") && text.includes("지원자격")) return "전교육과정국외이수자 지원자격";
    if (text.includes("북한이탈주민") && text.includes("지원자격")) return "북한이탈주민 지원자격";
    if (text.includes("전형방법")) return "전형방법 및 지원자격 심사";
    if (text.includes("지원자격")) return "재외국민 특별전형 지원자격";
    if (text.includes("제출서류")) return "재외국민 특별전형 제출서류";
    if (text.includes("모집단위") || text.includes("모집인원")) return "모집단위 및 모집인원";
    if (text.includes("전형일정")) return "전형일정";
    if (text.includes("원서접수")) return "원서접수 안내";
  }

  if (text.includes("전형별 지원자격 및 제출서류")) return "전형별 지원자격/제출서류 표";
  if (text.includes("검정고시 합격자제출 서류") || text.includes("검정고시 합격자")) return "검정고시 합격자 제출서류";
  if (text.includes("고등학교 학력인정 지원자의 제출서류")) return "학력인정 지원자 제출서류 유의사항";
  if (text.includes("서류종합평가")) return "서류종합평가 평가방법";
  if (text.includes("학생부종합[불교추천인재]")) return "불교추천인재 지원자격";
  if (text.includes("학생부종합[기회균형통합]")) return "기회균형통합 지원자격";
  if (text.includes("원서접수 및 서류 제출")) return "원서접수 및 서류제출";
  if (text.includes("전형일정")) return "전형일정";

  const cleaned = text
    .replace(/^\d+\s*DONGGUK UNIVERSITY\s*/i, "")
    .replace(/^20\d{2}학년도\s*동국대학교\s*/i, "")
    .replace(/^학년도\s*동국대학교\s*재외국민\s*특별전형\s*모집요강\s*20\d{2}\s*\d*\s*/i, "")
    .replace(/^20\d{2}\s*\d+\s*/i, "")
    .split("□")[0]
    .trim();
  return cleaned.length > 24 ? `${cleaned.slice(0, 24)}...` : cleaned || "근거 페이지";
}

function setEvidenceViewer(source, index) {
  if (!source) {
    $("viewerTitle").textContent = "상담 보조안 생성 후 PDF가 표시됩니다.";
    $("viewerPageLink").href = "#";
    $("viewerPdfLink").href = "#";
    $("viewerPageLink").setAttribute("aria-disabled", "true");
    $("viewerPdfLink").setAttribute("aria-disabled", "true");
    $("evidencePdfFrame").removeAttribute("src");
    $("evidencePdfFrame").removeAttribute("srcdoc");
    $("viewerPdfLink").textContent = "PDF 열기";
    $("pageJumpRow").innerHTML = "";
    return;
  }

  const pdfHref = safeHref(source.url);
  const pageHref = safeHref(pageUrl(source));
  const frameHref = safeHref(framePageUrl(source));
  $("viewerTitle").textContent = source.page
    ? `${source.title} p.${source.page} · ${source.section}`
    : `${source.title} · ${source.section || "웹 원문"}`;
  $("viewerPageLink").href = pageHref;
  $("viewerPdfLink").href = pdfHref;
  $("viewerPdfLink").textContent = isPdfSource(source) ? "PDF 열기" : "원문 열기";
  $("viewerPageLink").setAttribute("aria-disabled", "false");
  $("viewerPdfLink").setAttribute("aria-disabled", "false");

  if (isPdfSource(source)) {
    $("evidencePdfFrame").removeAttribute("srcdoc");
    $("evidencePdfFrame").src = "about:blank";
    window.setTimeout(() => {
      $("evidencePdfFrame").src = frameHref;
    }, 0);
  } else {
    const safeTitle = escapeHtml(source.title);
    const safeQuote = escapeHtml(source.quote || "원문 링크에서 상세 내용을 확인하세요.");
    const safePageHref = escapeHtml(pageHref);
    $("evidencePdfFrame").src = "about:blank";
    $("evidencePdfFrame").srcdoc = `
      <html lang="ko">
        <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; line-height: 1.6; color: #1f2937;">
          <p style="margin: 0 0 8px; color: #6b7280; font-size: 13px;">웹 원문 근거</p>
          <h2 style="margin: 0 0 16px; font-size: 20px;">${safeTitle}</h2>
          <p style="white-space: pre-wrap;">${safeQuote}</p>
          <p><a href="${safePageHref}" target="_blank" rel="noreferrer">입학처 원문 열기</a></p>
        </body>
      </html>`;
  }

  document.querySelectorAll(".evidence-card").forEach((card, cardIndex) => {
    card.classList.toggle("active", cardIndex === index);
  });

  document.querySelectorAll(".page-jump-button").forEach((button, buttonIndex) => {
    button.classList.toggle("active", buttonIndex === index);
  });
}

function renderPageJumpButtons(sources) {
  const row = $("pageJumpRow");
  row.innerHTML = "";

  if (!sources.length) return;

  const label = document.createElement("span");
  label.className = "page-jump-label";
  label.textContent = "근거 페이지";
  row.appendChild(label);

  sources.forEach((source, index) => {
    const button = document.createElement("button");
    button.className = `page-jump-button${index === 0 ? " active" : ""}`;
    button.type = "button";
    button.textContent = source.page ? `p.${source.page} · ${evidenceLabel(source)}` : `웹 · ${evidenceLabel(source)}`;
    button.title = source.page ? `${source.title} p.${source.page}` : `${source.title} 원문`;
    button.addEventListener("click", () => {
      setEvidenceViewer(state.evidenceSources[index], index);
    });
    row.appendChild(button);
  });
}

async function searchEvidence(question, year, recruitment, track) {
  const documentExceptionHints = /사유서|성적증명서|성적표|기말고사|고3|미산출|안나온|안나옴|학기결손/.test(question.replace(/\s/g, ""))
    ? "사유서 성적증명서 제출서류 서류제출 유의사항 증빙자료"
    : "";
  const query = [question, year, recruitment, transferTypeValue(), track, documentExceptionHints].filter(Boolean).join(" ");
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error("Search failed");
    const data = await response.json();
    if (!data.results || data.results.length === 0) {
      return data.indexed ? [] : sampleSources;
    }
    return data.results.map((result) => ({
      title: result.title,
      type: result.source_type,
      sourceKind: result.source_kind,
      year: result.admission_year,
      recruitment: result.recruitment_type,
      track: "",
      page: result.page,
      section: result.section,
      url: result.source_url,
      pageUrl: result.page_url,
      quote: result.content.length > 260 ? `${result.content.slice(0, 260)}...` : result.content
    }));
  } catch (error) {
    return [];
  }
}

async function analyzeWithServer(question, year, recruitment, track, transferType) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      question,
      year,
      recruitment,
      track,
      transferType
    })
  });

  if (!response.ok) throw new Error("Analysis failed");
  return response.json();
}

function normalizeSourceFromServer(source) {
  return {
    title: source.title,
    type: source.type,
    sourceKind: source.sourceKind,
    year: source.year,
    recruitment: source.recruitment,
    track: source.track || "",
    page: source.page,
    section: source.section,
    url: source.url,
    pageUrl: source.pageUrl,
    quote: source.quote || ""
  };
}

function renderEvidence(sources) {
  const list = $("evidenceList");
  list.innerHTML = "";
  list.classList.toggle("compact", sources.length > 0);
  state.evidenceSources = sources;

  if (!sources.length) {
    $("primaryEvidence").textContent = "핵심 근거: 직접 근거 없음. 담당자 확인 또는 문서 추가가 필요합니다.";
    $("evidenceSummaryText").textContent = "근거 없음";
    setEvidenceViewer(null, -1);
    renderPageJumpButtons([]);
    list.innerHTML = "";
    return;
  }

  const primary = sources[0];
  $("primaryEvidence").textContent = primary.page
    ? `핵심 근거: ${primary.title} p.${primary.page} · ${primary.section}`
    : `핵심 근거: ${primary.title} · ${primary.section || "웹 원문"}`;
  $("evidenceSummaryText").textContent = `근거 ${sources.length}건`;
  renderPageJumpButtons(sources);
  setEvidenceViewer(primary, 0);

  list.innerHTML = "";
}

async function renderAnalysis() {
  const question = $("questionInput").value.trim();
  const year = $("yearInput").value;
  const recruitment = $("recruitmentInput").value;
  const transferType = transferTypeValue();
  const track = normalizeTrackValue($("trackInput").value);

  if (!question) {
    $("questionInput").focus();
    return;
  }

  $("statusValue").textContent = "근거 검색 중";
  $("analyzeButton").disabled = true;

  let intent = inferIntent(question);
  let risk = inferRisk(intent, question);
  let followUps = [];
  let draftAnswer = "";
  let cautions = [];
  let sources = [];
  let serverAnalysis = null;

  try {
    serverAnalysis = await analyzeWithServer(question, year, recruitment, track, transferType);
    intent = serverAnalysis.intent;
    risk = serverAnalysis.risk_level;
    followUps = serverAnalysis.follow_up_questions || [];
    draftAnswer = serverAnalysis.draft_answer;
    cautions = serverAnalysis.cautions || [];
    sources = (serverAnalysis.sources || []).map(normalizeSourceFromServer);
  } catch (error) {
    followUps = buildFollowUps(intent, year, recruitment, track, question);
    draftAnswer = buildAnswer(intent, risk, year, recruitment, track, transferType, question);
    cautions = buildCautions(intent, risk);
    sources = await searchEvidence(question, year, recruitment, track);
  } finally {
    $("analyzeButton").disabled = false;
  }

  state.lastAnalysis = {
    question_raw: question,
    question_summary: `${intent} 관련 문의`,
    admission_year: year,
    recruitment_type: recruitment,
    transfer_type: transferType || "해당 없음",
    admission_track: track || "확인 필요",
    intent,
    risk_level: risk,
    follow_up_questions: followUps,
    draft_answer: draftAnswer,
    sources: sources.map((source) => ({
      title: source.title,
      page: source.page,
      section: source.section,
      url: source.url,
      page_url: pageUrl(source)
    })),
    search_query: serverAnalysis?.search_query || ""
  };

  $("intentValue").textContent = intent;
  $("contextValue").textContent = `${year} ${recruitmentLabel(recruitment)}${transferType ? ` / ${transferType}` : ""}${track ? ` / ${track}` : ""}`;
  $("statusValue").textContent = risk === "high" ? "담당자 확인 권장" : "상담원 확인 후 사용";

  const riskBadge = $("riskBadge");
  riskBadge.className = `risk-badge ${risk}`;
  riskBadge.textContent = risk === "high" ? "높은 위험" : risk === "medium" ? "중간 위험" : "낮은 위험";

  $("followUpList").innerHTML = followUps.map((item) => `<li>${item}</li>`).join("");
  $("draftAnswer").textContent = draftAnswer;
  $("cautionList").innerHTML = cautions.map((item) => `<li>${item}</li>`).join("");
  renderEvidence(sources);
  renderRecordPreview();
}

function renderRecordPreview() {
  if (!state.lastAnalysis) return;

  const record = {
    ...state.lastAnalysis,
    human_modified: $("humanModified").checked,
    faq_candidate: $("faqCandidate").checked,
    required_human_review: $("needsReview").checked || state.lastAnalysis.risk_level === "high",
    resolution_status: $("needsReview").checked ? "needs_review" : "drafted",
    created_at: new Date().toISOString()
  };

  $("recordPreview").textContent = JSON.stringify(record, null, 2);
}

function bindEvents() {
  $("sampleButton").addEventListener("click", () => {
    $("questionInput").value = "검정고시생도 학생부종합 지원 가능한가요?";
    $("yearInput").value = "2027";
    $("recruitmentInput").value = "수시";
    updateTransferTypeVisibility();
    populateTrackOptions("학생부종합");
    $("trackInput").value = "학생부종합";
    renderAnalysis();
  });

  $("recruitmentInput").addEventListener("change", () => {
    updateTransferTypeVisibility();
    populateTrackOptions();
  });
  $("analyzeButton").addEventListener("click", renderAnalysis);
  $("saveRecordButton").addEventListener("click", renderRecordPreview);
  $("humanModified").addEventListener("change", renderRecordPreview);
  $("faqCandidate").addEventListener("change", renderRecordPreview);
  $("needsReview").addEventListener("change", renderRecordPreview);
  $("copyAnswerButton").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("draftAnswer").textContent);
    $("copyAnswerButton").textContent = "복사됨";
    setTimeout(() => {
      $("copyAnswerButton").textContent = "복사";
    }, 1200);
  });

  $("evidenceList").innerHTML = "";
  setEvidenceViewer(null, -1);
}

updateTransferTypeVisibility();
populateTrackOptions();
bindEvents();
