using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace WhaleDesktop
{
    internal sealed class OverlayFormV3 : Form
    {
        private const int WS_EX_NOACTIVATE = 0x08000000;
        private const int WS_EX_TOOLWINDOW = 0x00000080;
        private const int ToolbarHeight = 54;
        private const int PanelHeader = 64;
        private const int PanelHeight = 380;
        private const int WidthValue = 700;

        private readonly string selectedText;
        private readonly Point anchor;
        private Image whaleImage;
        private readonly Label aiLabel;
        private readonly Label copySourceLabel;
        private readonly Label translateLabel;
        private readonly Label readLabel;
        private readonly Label summaryLabel;
        private readonly Label moreLabel;
        private readonly Label backLabel;
        private readonly Label closeLabel;
        private readonly Panel bodyPanel;
        private readonly Panel metaPanel;
        private readonly Label metaLabel;
        private readonly RichTextBox resultBox;
        private readonly Label statusLabel;
        private readonly Button copyResultButton;
        private bool panelMode;
        private int generation;
        private string resultText = "";

        public OverlayFormV3(string text, Point point)
        {
            selectedText = text;
            anchor = point;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            ShowInTaskbar = false;
            TopMost = true;
            BackColor = Color.FromArgb(6, 26, 38);
            ForeColor = Color.White;
            Font = new Font("Microsoft YaHei", 9f, FontStyle.Regular, GraphicsUnit.Point);
            Width = WidthValue;
            Height = ToolbarHeight;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);
            LoadWhaleImage();

            aiLabel = MakeAction("AI 搜索", new Rectangle(130, 8, 90, 38), false, delegate { OpenSearch(); });
            copySourceLabel = MakeAction("复制", new Rectangle(228, 8, 70, 38), false, delegate { CopyOriginal(); });
            translateLabel = MakeAction("翻译", new Rectangle(306, 8, 82, 38), true, delegate { ShowPanel(); });
            readLabel = MakeAction("朗读", new Rectangle(396, 8, 72, 38), false, delegate { Speak(selectedText); });
            summaryLabel = MakeAction("总结", new Rectangle(476, 8, 72, 38), false, delegate { ShowSummary(); });
            moreLabel = MakeAction("更多", new Rectangle(556, 8, 72, 38), false, delegate { ShowMore(); });
            closeLabel = MakeAction("×", new Rectangle(650, 8, 32, 38), false, delegate { Hide(); });

            backLabel = MakeAction("‹", new Rectangle(618, 16, 30, 32), true, delegate { BackToToolbar(); });
            backLabel.Font = new Font("Microsoft YaHei", 14f, FontStyle.Regular, GraphicsUnit.Point);
            backLabel.Visible = false;

            bodyPanel = new Panel();
            bodyPanel.Bounds = new Rectangle(1, PanelHeader, Width - 2, 1);
            bodyPanel.BackColor = Color.FromArgb(247, 251, 252);
            bodyPanel.Visible = false;
            bodyPanel.Paint += PaintBodyBorder;
            Controls.Add(bodyPanel);

            metaPanel = new Panel();
            metaPanel.Bounds = new Rectangle(16, 16, Width - 34, 44);
            metaPanel.BackColor = Color.White;
            metaPanel.Paint += PaintMetaBorder;
            bodyPanel.Controls.Add(metaPanel);

            bool chinese = Regex.IsMatch(selectedText, "[\u4e00-\u9fff]");
            metaLabel = new Label();
            metaLabel.Text = chinese ? "自动检测 · 中文 → English" : "自动检测 · English → 中文";
            metaLabel.Bounds = new Rectangle(30, 12, metaPanel.Width - 44, 22);
            metaLabel.BackColor = Color.Transparent;
            metaLabel.ForeColor = Color.FromArgb(28, 60, 72);
            metaLabel.Font = new Font("Microsoft YaHei", 9f, FontStyle.Regular, GraphicsUnit.Point);
            metaPanel.Controls.Add(metaLabel);

            resultBox = new RichTextBox();
            resultBox.Bounds = new Rectangle(16, 74, Width - 32, 174);
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
            statusLabel.Bounds = new Rectangle(16, 276, 260, 22);
            statusLabel.BackColor = Color.Transparent;
            statusLabel.ForeColor = Color.FromArgb(91, 124, 136);
            statusLabel.Font = new Font("Microsoft YaHei", 8f, FontStyle.Regular, GraphicsUnit.Point);
            statusLabel.Visible = false;
            bodyPanel.Controls.Add(statusLabel);

            copyResultButton = new Button();
            copyResultButton.Text = "复制译文";
            copyResultButton.Bounds = new Rectangle(566, 266, 116, 32);
            copyResultButton.FlatStyle = FlatStyle.Flat;
            copyResultButton.FlatAppearance.BorderColor = Color.FromArgb(181, 218, 224);
            copyResultButton.BackColor = Color.White;
            copyResultButton.ForeColor = Color.FromArgb(10, 127, 140);
            copyResultButton.Font = new Font("Microsoft YaHei", 8.5f, FontStyle.Regular, GraphicsUnit.Point);
            copyResultButton.Cursor = Cursors.Hand;
            copyResultButton.Visible = false;
            copyResultButton.Click += delegate
            {
                try
                {
                    Clipboard.SetText(resultText);
                    copyResultButton.Text = "已复制";
                }
                catch { copyResultButton.Text = "复制失败"; }
            };
            bodyPanel.Controls.Add(copyResultButton);

            SetRoundedRegion();
            PositionNearAnchor();
        }

        private Label MakeAction(string text, Rectangle bounds, bool primary, EventHandler click)
        {
            Label label = new Label();
            label.Text = text;
            label.Bounds = bounds;
            label.TextAlign = ContentAlignment.MiddleCenter;
            label.BackColor = Color.Transparent;
            label.ForeColor = primary ? Color.White : Color.FromArgb(205, 228, 234);
            label.Font = new Font("Microsoft YaHei", 9f, primary ? FontStyle.Bold : FontStyle.Regular, GraphicsUnit.Point);
            label.Cursor = Cursors.Hand;
            label.Click += click;
            Color normal = label.ForeColor;
            label.MouseEnter += delegate { label.ForeColor = Color.White; };
            label.MouseLeave += delegate { label.ForeColor = normal; };
            Controls.Add(label);
            return label;
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

        protected override void OnPaint(PaintEventArgs e)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            e.Graphics.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
            int header = panelMode ? PanelHeader : ToolbarHeight;
            Rectangle rect = new Rectangle(0, 0, Width, header);
            using (LinearGradientBrush brush = new LinearGradientBrush(rect, Color.FromArgb(6, 22, 34), Color.FromArgb(13, 58, 72), 0f))
            {
                e.Graphics.FillRectangle(brush, rect);
            }
            using (SolidBrush glow = new SolidBrush(Color.FromArgb(26, 70, 190, 200)))
            {
                e.Graphics.FillEllipse(glow, Width - 180, -70, 220, 150);
            }
            using (Pen line = new Pen(Color.FromArgb(35, 90, 110), 1f))
            {
                e.Graphics.DrawLine(line, 0, header - 1, Width, header - 1);
            }

            if (whaleImage != null)
            {
                e.Graphics.DrawImage(whaleImage, 16, (header - 32) / 2, 32, 32);
            }
            else
            {
                using (SolidBrush circle = new SolidBrush(Color.FromArgb(32, 196, 204)))
                {
                    e.Graphics.FillEllipse(circle, 16, (header - 32) / 2, 32, 32);
                }
            }

            using (Font titleFont = new Font("Microsoft YaHei", 13f, FontStyle.Bold, GraphicsUnit.Point))
            using (SolidBrush white = new SolidBrush(Color.White))
            {
                e.Graphics.DrawString("鲸译", titleFont, white, 56, panelMode ? 9 : 11);
            }

            if (panelMode)
            {
                using (Font subFont = new Font("Segoe UI", 7.2f, FontStyle.Regular, GraphicsUnit.Point))
                using (SolidBrush subBrush = new SolidBrush(Color.FromArgb(150, 199, 211)))
                {
                    e.Graphics.DrawString("WHALE MODE · 英汉互译", subFont, subBrush, 58, 33);
                }
            }
            else
            {
                using (Pen sep = new Pen(Color.FromArgb(55, 110, 128), 1f))
                {
                    e.Graphics.DrawLine(sep, 120, 13, 120, 41);
                }
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

        private void SetToolbarVisible(bool visible)
        {
            aiLabel.Visible = visible;
            copySourceLabel.Visible = visible;
            translateLabel.Visible = visible;
            readLabel.Visible = visible;
            summaryLabel.Visible = visible;
            moreLabel.Visible = visible;
        }

        private void ShowPanel()
        {
            OpenPanel();
            TranslateSelection();
        }

        private void OpenPanel()
        {
            if (panelMode) return;
            panelMode = true;
            Height = PanelHeight;
            SetToolbarVisible(false);
            backLabel.Visible = true;
            closeLabel.Bounds = new Rectangle(652, 16, 32, 32);
            bodyPanel.Visible = true;
            bodyPanel.Bounds = new Rectangle(1, PanelHeader, Width - 2, Height - PanelHeader - 1);
            resultBox.Visible = true;
            statusLabel.Visible = true;
            copyResultButton.Visible = true;
            statusLabel.Top = bodyPanel.Height - 40;
            copyResultButton.Top = bodyPanel.Height - 48;
            PositionNearAnchor();
            Invalidate();
        }

        private void BackToToolbar()
        {
            generation += 1;
            panelMode = false;
            Height = ToolbarHeight;
            bodyPanel.Visible = false;
            SetToolbarVisible(true);
            backLabel.Visible = false;
            closeLabel.Bounds = new Rectangle(650, 8, 32, 38);
            resultText = "";
            PositionNearAnchor();
            Invalidate();
        }

        private async void TranslateSelection()
        {
            int current = ++generation;
            resultText = "";
            resultBox.Text = "";
            statusLabel.Text = "正在翻译…";
            copyResultButton.Visible = false;
            try
            {
                string translation = await Translator.TranslateAsync(selectedText);
                if (current != generation) return;
                resultText = translation;
                resultBox.Text = translation;
                statusLabel.Text = "BING · 翻译";
                copyResultButton.Visible = true;
                Log.Write("desktop translated " + selectedText.Length + " chars");
            }
            catch (Exception ex)
            {
                if (current != generation) return;
                resultBox.Text = "翻译失败：" + ex.Message;
                statusLabel.Text = "翻译未完成";
                Log.Write("desktop translate: " + ex);
            }
        }

        private void ShowSummary()
        {
            OpenPanel();
            generation += 1;
            resultText = BuildSummary(selectedText);
            resultBox.Text = resultText;
            statusLabel.Text = "本地摘要 · 不联网";
            copyResultButton.Visible = true;
        }

        private static string BuildSummary(string text)
        {
            string normalized = Regex.Replace(text, "\\s+", " ").Trim();
            string[] parts = Regex.Split(normalized, "(?<=[。！？.!?])\\s+");
            StringBuilder builder = new StringBuilder();
            for (int index = 0; index < parts.Length && index < 3; index++)
            {
                string part = parts[index].Trim();
                if (part.Length == 0) continue;
                if (builder.Length + part.Length > 240) break;
                if (builder.Length > 0) builder.Append(" ");
                builder.Append(part);
            }
            if (builder.Length == 0) builder.Append(normalized.Substring(0, Math.Min(normalized.Length, 240)));
            return builder.ToString();
        }

        private void CopyOriginal()
        {
            try
            {
                Clipboard.SetText(selectedText);
                copySourceLabel.Text = "已复制";
            }
            catch { copySourceLabel.Text = "复制失败"; }
        }

        private void OpenSearch()
        {
            try
            {
                Process.Start("https://www.bing.com/search?q=" + Uri.EscapeDataString(selectedText));
            }
            catch (Exception ex)
            {
                Log.Write("desktop search: " + ex.Message);
            }
        }

        private void Speak(string text)
        {
            try
            {
                Type voiceType = Type.GetTypeFromProgID("SAPI.SpVoice");
                if (voiceType == null) return;
                object voice = Activator.CreateInstance(voiceType);
                voiceType.InvokeMember("Speak", BindingFlags.InvokeMethod, null, voice, new object[] { text, 1 });
            }
            catch (Exception ex)
            {
                Log.Write("desktop speak: " + ex.Message);
            }
        }

        private void ShowMore()
        {
            ContextMenuStrip menu = new ContextMenuStrip();
            menu.Items.Add("复制原文", null, delegate { CopyOriginal(); });
            if (resultText.Length > 0)
            {
                menu.Items.Add("复制译文", null, delegate
                {
                    try { Clipboard.SetText(resultText); } catch { }
                });
            }
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("关闭", null, delegate { Hide(); });
            menu.Show(moreLabel, new Point(0, moreLabel.Height));
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
