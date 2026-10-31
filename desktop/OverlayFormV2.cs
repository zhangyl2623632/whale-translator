using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace WhaleDesktop
{
    internal sealed class OverlayFormV2 : Form
    {
        private const int WS_EX_NOACTIVATE = 0x08000000;
        private const int WS_EX_TOOLWINDOW = 0x00000080;
        private const int HeaderHeight = 64;
        private const int PanelHeight = 356;

        private readonly string selectedText;
        private readonly Point anchor;
        private Image whaleImage;
        private readonly Panel bodyPanel;
        private readonly Panel metaPanel;
        private readonly Label metaLabel;
        private readonly RichTextBox resultBox;
        private readonly Label statusLabel;
        private readonly Button translateButton;
        private readonly Button closeButton;
        private readonly Button copyButton;
        private bool translated;

        public OverlayFormV2(string text, Point point)
        {
            selectedText = text;
            anchor = point;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            ShowInTaskbar = false;
            TopMost = true;
            BackColor = Color.FromArgb(7, 27, 40);
            ForeColor = Color.White;
            Font = new Font("Microsoft YaHei", 9f, FontStyle.Regular, GraphicsUnit.Point);
            Width = 430;
            Height = HeaderHeight;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
            LoadWhaleImage();

            bool chinese = Regex.IsMatch(selectedText, "[\u4e00-\u9fff]");
            string direction = chinese ? "自动检测 · 中文 → English" : "自动检测 · English → 中文";

            translateButton = new Button();
            translateButton.Text = "翻译";
            translateButton.Bounds = new Rectangle(306, 16, 64, 32);
            translateButton.FlatStyle = FlatStyle.Flat;
            translateButton.FlatAppearance.BorderSize = 0;
            translateButton.BackColor = Color.FromArgb(32, 196, 204);
            translateButton.ForeColor = Color.FromArgb(3, 35, 43);
            translateButton.Font = new Font("Microsoft YaHei", 9f, FontStyle.Bold, GraphicsUnit.Point);
            translateButton.Cursor = Cursors.Hand;
            translateButton.Click += TranslateButtonClick;
            Controls.Add(translateButton);

            closeButton = new Button();
            closeButton.Text = "×";
            closeButton.Bounds = new Rectangle(378, 16, 32, 32);
            closeButton.FlatStyle = FlatStyle.Flat;
            closeButton.FlatAppearance.BorderSize = 0;
            closeButton.BackColor = Color.FromArgb(7, 27, 40);
            closeButton.ForeColor = Color.FromArgb(170, 205, 213);
            closeButton.Font = new Font("Microsoft YaHei", 14f, FontStyle.Regular, GraphicsUnit.Point);
            closeButton.Cursor = Cursors.Hand;
            closeButton.Click += delegate { Hide(); };
            Controls.Add(closeButton);

            bodyPanel = new Panel();
            bodyPanel.Bounds = new Rectangle(1, HeaderHeight, Width - 2, 1);
            bodyPanel.BackColor = Color.FromArgb(247, 251, 252);
            bodyPanel.Visible = false;
            bodyPanel.Paint += PaintBodyBorder;
            Controls.Add(bodyPanel);

            metaPanel = new Panel();
            metaPanel.Bounds = new Rectangle(16, 16, Width - 34, 44);
            metaPanel.BackColor = Color.White;
            metaPanel.Paint += PaintMetaBorder;
            bodyPanel.Controls.Add(metaPanel);

            metaLabel = new Label();
            metaLabel.Text = direction;
            metaLabel.Bounds = new Rectangle(30, 12, metaPanel.Width - 44, 22);
            metaLabel.BackColor = Color.Transparent;
            metaLabel.ForeColor = Color.FromArgb(28, 60, 72);
            metaLabel.Font = new Font("Microsoft YaHei", 9f, FontStyle.Regular, GraphicsUnit.Point);
            metaPanel.Controls.Add(metaLabel);

            resultBox = new RichTextBox();
            resultBox.Bounds = new Rectangle(16, 74, Width - 32, 154);
            resultBox.BackColor = Color.FromArgb(247, 251, 252);
            resultBox.ForeColor = Color.FromArgb(12, 32, 44);
            resultBox.BorderStyle = BorderStyle.None;
            resultBox.ReadOnly = true;
            resultBox.DetectUrls = false;
            resultBox.ScrollBars = RichTextBoxScrollBars.Vertical;
            resultBox.Font = new Font("Microsoft YaHei", 11f, FontStyle.Regular, GraphicsUnit.Point);
            resultBox.Visible = false;
            bodyPanel.Controls.Add(resultBox);

            statusLabel = new Label();
            statusLabel.Bounds = new Rectangle(16, 238, 230, 22);
            statusLabel.BackColor = Color.Transparent;
            statusLabel.ForeColor = Color.FromArgb(91, 124, 136);
            statusLabel.Font = new Font("Microsoft YaHei", 8f, FontStyle.Regular, GraphicsUnit.Point);
            statusLabel.Visible = false;
            bodyPanel.Controls.Add(statusLabel);

            copyButton = new Button();
            copyButton.Text = "复制译文";
            copyButton.Bounds = new Rectangle(296, 230, 116, 32);
            copyButton.FlatStyle = FlatStyle.Flat;
            copyButton.FlatAppearance.BorderColor = Color.FromArgb(181, 218, 224);
            copyButton.BackColor = Color.White;
            copyButton.ForeColor = Color.FromArgb(10, 127, 140);
            copyButton.Font = new Font("Microsoft YaHei", 8.5f, FontStyle.Regular, GraphicsUnit.Point);
            copyButton.Cursor = Cursors.Hand;
            copyButton.Visible = false;
            copyButton.Click += delegate
            {
                try
                {
                    Clipboard.SetText(resultBox.Text);
                    copyButton.Text = "已复制";
                }
                catch { copyButton.Text = "复制失败"; }
            };
            bodyPanel.Controls.Add(copyButton);

            SetRoundedRegion();
            PositionNearAnchor();
        }

        protected override bool ShowWithoutActivation
        {
            get { return true; }
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.ExStyle |= WS_EX_NOACTIVATE | WS_EX_TOOLWINDOW;
                return cp;
            }
        }

        private void LoadWhaleImage()
        {
            try
            {
                Icon appIcon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                if (appIcon != null)
                {
                    using (Icon sized = new Icon(appIcon, 32, 32))
                    {
                        whaleImage = sized.ToBitmap();
                    }
                }
            }
            catch { }
        }

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;

            Rectangle header = new Rectangle(0, 0, Width, HeaderHeight);
            using (LinearGradientBrush brush = new LinearGradientBrush(header, Color.FromArgb(6, 22, 34), Color.FromArgb(13, 58, 72), 0f))
            {
                e.Graphics.FillRectangle(brush, header);
            }
            using (SolidBrush glow = new SolidBrush(Color.FromArgb(28, 70, 190, 200)))
            {
                e.Graphics.FillEllipse(glow, Width - 130, -50, 180, 120);
            }
            using (Pen line = new Pen(Color.FromArgb(35, 90, 110), 1f))
            {
                e.Graphics.DrawLine(line, 0, HeaderHeight - 1, Width, HeaderHeight - 1);
            }

            if (whaleImage != null)
            {
                e.Graphics.DrawImage(whaleImage, 16, 16, 32, 32);
            }
            else
            {
                using (SolidBrush circle = new SolidBrush(Color.FromArgb(32, 196, 204)))
                {
                    e.Graphics.FillEllipse(circle, 16, 16, 32, 32);
                }
            }

            using (Font titleFont = new Font("Microsoft YaHei", 13f, FontStyle.Bold, GraphicsUnit.Point))
            using (Font subFont = new Font("Segoe UI", 7.2f, FontStyle.Regular, GraphicsUnit.Point))
            using (SolidBrush titleBrush = new SolidBrush(Color.White))
            using (SolidBrush subBrush = new SolidBrush(Color.FromArgb(150, 199, 211)))
            {
                e.Graphics.DrawString("鲸译", titleFont, titleBrush, 56, 10);
                e.Graphics.DrawString("WHALE MODE · 英汉互译", subFont, subBrush, 58, 34);
            }

            Rectangle chip = new Rectangle(206, 20, 94, 24);
            using (GraphicsPath path = RoundedRect(chip, 12))
            using (SolidBrush fill = new SolidBrush(Color.FromArgb(30, 255, 255, 255)))
            using (Pen border = new Pen(Color.FromArgb(65, 155, 175), 1f))
            {
                e.Graphics.FillPath(fill, path);
                e.Graphics.DrawPath(border, path);
            }
            string direction = Regex.IsMatch(selectedText, "[\u4e00-\u9fff]")
                ? "中文 → English"
                : "English → 中文";
            using (Font chipFont = new Font("Microsoft YaHei", 8f, FontStyle.Regular, GraphicsUnit.Point))
            using (SolidBrush chipText = new SolidBrush(Color.FromArgb(204, 236, 240)))
            using (StringFormat format = new StringFormat())
            {
                format.Alignment = StringAlignment.Center;
                format.LineAlignment = StringAlignment.Center;
                e.Graphics.DrawString(direction, chipFont, chipText, chip, format);
            }

            base.OnPaint(e);
        }

        private void PaintMetaBorder(object sender, PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            Rectangle rect = new Rectangle(0, 0, metaPanel.Width - 1, metaPanel.Height - 1);
            using (GraphicsPath path = RoundedRect(rect, 12))
            using (Pen pen = new Pen(Color.FromArgb(209, 230, 234), 1f))
            {
                e.Graphics.DrawPath(pen, path);
            }
            using (SolidBrush dot = new SolidBrush(Color.FromArgb(47, 199, 187)))
            {
                e.Graphics.FillEllipse(dot, 18, 19, 6, 6);
            }
        }

        private void PaintBodyBorder(object sender, PaintEventArgs e)
        {
            using (Pen pen = new Pen(Color.FromArgb(218, 233, 237), 1f))
            {
                e.Graphics.DrawRectangle(pen, 0, 0, bodyPanel.Width - 1, bodyPanel.Height - 1);
            }
        }

        private static GraphicsPath RoundedRect(Rectangle rect, int radius)
        {
            GraphicsPath path = new GraphicsPath();
            int d = radius * 2;
            path.AddArc(rect.Left, rect.Top, d, d, 180, 90);
            path.AddArc(rect.Right - d, rect.Top, d, d, 270, 90);
            path.AddArc(rect.Right - d, rect.Bottom - d, d, d, 0, 90);
            path.AddArc(rect.Left, rect.Bottom - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            SetRoundedRegion();
        }

        private void SetRoundedRegion()
        {
            try
            {
                using (GraphicsPath path = RoundedRect(new Rectangle(0, 0, Width, Height), 14))
                {
                    Region old = Region;
                    Region = new Region(path);
                    if (old != null) old.Dispose();
                }
            }
            catch { }
        }

        private void PositionNearAnchor()
        {
            Rectangle area = Screen.FromPoint(anchor).WorkingArea;
            int x = anchor.X;
            int y = anchor.Y + 20;
            if (x + Width > area.Right) x = area.Right - Width - 8;
            if (x < area.Left) x = area.Left + 8;
            if (y + Height > area.Bottom) y = anchor.Y - Height - 20;
            if (y < area.Top) y = area.Top + 8;
            Location = new Point(x, y);
        }

        private async void TranslateButtonClick(object sender, EventArgs e)
        {
            if (!translated)
            {
                translated = true;
                Height = PanelHeight;
                bodyPanel.Visible = true;
                bodyPanel.Bounds = new Rectangle(1, HeaderHeight, Width - 2, Height - HeaderHeight - 1);
                resultBox.Visible = true;
                resultBox.Text = "";
                statusLabel.Visible = true;
                statusLabel.Text = "正在翻译…";
                statusLabel.Top = bodyPanel.Height - 42;
                copyButton.Visible = true;
                copyButton.Top = bodyPanel.Height - 50;
                translateButton.Text = "…";
                translateButton.Enabled = false;
                PositionNearAnchor();
                try
                {
                    string translation = await Translator.TranslateAsync(selectedText);
                    resultBox.Text = translation;
                    statusLabel.Text = "BING · 翻译";
                    translateButton.Text = "重试";
                    Log.Write("translated " + selectedText.Length + " chars");
                }
                catch (Exception ex)
                {
                    resultBox.Text = "翻译失败：" + ex.Message;
                    statusLabel.Text = "翻译未完成";
                    translateButton.Text = "重试";
                    Log.Write("translate: " + ex);
                }
                finally
                {
                    translateButton.Enabled = true;
                }
                return;
            }

            statusLabel.Text = "正在翻译…";
            translateButton.Text = "…";
            translateButton.Enabled = false;
            try
            {
                string translation = await Translator.TranslateAsync(selectedText);
                resultBox.Text = translation;
                statusLabel.Text = "BING · 翻译";
            }
            catch (Exception ex)
            {
                resultBox.Text = "翻译失败：" + ex.Message;
                statusLabel.Text = "翻译未完成";
            }
            finally
            {
                translateButton.Text = "重试";
                translateButton.Enabled = true;
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing && whaleImage != null)
            {
                whaleImage.Dispose();
                whaleImage = null;
            }
            base.Dispose(disposing);
        }
    }
}
