# Suno Prompt Workstation 2026 V4 — Semantic Music Director

## Mục tiêu
V4 giữ nguyên workflow/UI V3 đang chạy ổn trong Google AI Studio và chỉ nâng lớp quyết định âm nhạc.

## Nâng cấp chính
- Semantic-first Music Director: hiểu ý tưởng tổng thể trước khi chọn tag.
- Tránh chọn tag chỉ vì trùng một từ khóa; ưu tiên tính nhất quán giữa genre, mood, vocal, instrument, production và performance.
- Khi catalog không có tag đủ chính xác, chọn ít hơn thay vì chọn sai.
- Thêm `confidence` 0–1 cho Music Director.
- Kết quả Music Director ghi rõ engine: `gemini` hoặc `local`.
- UI hiển thị trạng thái `Gemini AI` / `Local Fallback`, model đang dùng và confidence của lần chạy gần nhất.
- `/api/health` trả `aiConfigured` và model để frontend biết API server-side có sẵn hay không.
- Gemini model được cấu hình tập trung qua `GEMINI_MODEL`; mặc định vẫn là `gemini-2.5-flash`.
- Local fallback được tăng semantic rules cho các concept như Viking/Nordic/mythic battle/metal để tránh lệch sang các tag cảm xúc không phù hợp.

## Không API key
App vẫn mở, chọn tag thủ công, dựng Suno prompt và chạy Local Fallback. Các route Gemini trả 503 và frontend tự dùng engine local.

## Có API key
Music Director dùng Gemini server-side, trả tag đã lọc theo catalog + confidence + creative direction. API key không nằm ở frontend.

## Test gợi ý
1. `Nhạc metal Viking kể về cuộc chiến giữa rồng băng và thần sấm Bắc Âu`
2. `Người đàn ông trung niên nhớ người vợ đã xa trong đêm mưa Đà Lạt`
3. `Tiệc EDM mùa hè trên bãi biển, nữ vocal trẻ, năng lượng cao`

Kiểm tra: engine badge, confidence, tag coherence và Prompt Output.
