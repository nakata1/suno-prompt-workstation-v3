# Suno Prompt Workstation 2026 — Upgrade Notes

## Mục tiêu
Ứng dụng này là bộ hỗ trợ ý tưởng và chuẩn bị nội dung để đưa sang Suno Custom Mode. Nó không giả lập engine tạo nhạc của Suno và không cố điều khiển các tham số nội bộ không được Suno công khai.

## Nâng cấp chính
- Style Prompt được dựng theo dạng câu mô tả tự nhiên, giảm keyword stuffing và trùng lặp tag.
- Mặc định `Latest / Auto` để tránh phụ thuộc cứng vào một model Suno; vẫn có profile v5.5.
- Tự gợi ý Weirdness, Style Influence, Duration và Exclude dựa trên ý tưởng + tag đã chọn.
- Có nút sao chép một gói đầy đủ gồm Style, Lyrics và Advanced Options để chuyển sang Suno.
- Khi Google AI Studio cung cấp `process.env.API_KEY`, tối ưu ý tưởng và tạo lời dùng Gemini thật; nếu không có key hoặc lỗi mạng, ứng dụng tự fallback sang logic local cũ.
- Prompt AI tránh tự thêm tên nghệ sĩ/bài hát cụ thể và tập trung vào đặc tính âm nhạc.
- Các nhóm cũ mang tên “V5” vẫn được giữ tương thích dữ liệu, nhưng UI chuyển dần sang cách gọi model-agnostic để dễ thích nghi với model Suno mới.

## Workflow đề xuất
1. Nhập ý tưởng bằng tiếng Việt.
2. Tối ưu ý tưởng hoặc Tự động tạo.
3. Chọn/bổ sung Genre, Mood, Vocal, Instruments, Production.
4. Copy `Prompt Output` sang ô Styles của Suno Custom Mode.
5. Copy Lyrics sang ô Lyrics.
6. Dùng các giá trị gợi ý trong `Suno Settings` làm điểm khởi đầu cho Advanced Options.
7. Nếu kết quả lệch phong cách, tăng Style Influence. Nếu quá an toàn/lặp lại, tăng Weirdness vừa phải.

## Lưu ý
Các giá trị Weirdness / Style Influence / Duration là khuyến nghị sáng tạo, không phải API parameter được ứng dụng gửi trực tiếp sang Suno.
