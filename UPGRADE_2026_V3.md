# Suno Prompt Workstation 2026 v3 — AI Music Director

## Mục tiêu
Biến ý tưởng thô thành một bộ đầu vào Suno nhất quán, thay vì chỉ ghép nhiều tag độc lập.

## AI Music Director
- Đọc ý tưởng tiếng Việt hoặc tiếng Anh.
- Chọn một bộ tag nhỏ và đồng bộ từ chính catalog hiện có của app.
- Không cho AI tự bịa tag: kết quả được sanitize lại bằng whitelist.
- Tạo creative direction tiếng Anh ngắn, tự nhiên, phù hợp để đưa sang Suno Custom Mode.
- Có fallback local nếu Gemini/API key không khả dụng.

## Tương thích Suno 2026
- Giữ profile Latest / Auto để không khóa ứng dụng vào một model cụ thể.
- Có profile v5.5.
- Gợi ý Weirdness và Style Influence như điểm khởi đầu, không giả định đây là tham số API.
- Tách Exclude riêng theo Advanced Options.
- Duration chỉ là recommendation; v5.5 web hiện hỗ trợ Duration slider.
- Voices / Custom Models / My Taste là các tính năng phía Suno; app tập trung chuẩn bị prompt, không giả lập chúng.

## Nguyên tắc prompt
- Ưu tiên natural-language creative direction.
- Tránh keyword stuffing và tag mâu thuẫn.
- Không dùng tên ca sĩ, người nổi tiếng hoặc tên bài hát làm cách mô tả phong cách.
- Style Prompt và Lyrics được tách riêng.
