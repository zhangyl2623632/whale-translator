using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Automation.Text;
using System.Windows.Forms;

namespace WhaleDesktop
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            try
            {
                File.WriteAllText(Path.Combine(Path.GetTempPath(), "whale-desktop-boot.txt"), DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
            }
            catch { }
            bool created;
            using (Mutex mutex = new Mutex(true, "Local\\WhaleDesktopSpike", out created))
            {
                if (!created)
                {
                    MessageBox.Show("鲸译桌面版已经在运行。", "鲸译", MessageBoxButtons.OK, MessageBoxIcon.Information);
                    return;
                }
                try
                {
                    ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);
                    using (TrayContext context = new TrayContext())
                    {
                        Application.Run(context);
                    }
                }
                catch (Exception ex)
                {
                    Log.Write("fatal: " + ex);
                    MessageBox.Show("鲸译启动失败：\r\n" + ex.Message, "鲸译", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }
    }

    internal sealed class TrayContext : ApplicationContext
    {
        private readonly Form dispatcher;
        private readonly MouseHook hook;
        private readonly NotifyIcon tray;
        private HotkeyWindow hotkey;
        private string hotkeyLabel;
        private OverlayFormV2 overlay;

        public TrayContext()
        {
            dispatcher = new Form();
            dispatcher.ShowInTaskbar = false;
            dispatcher.FormBorderStyle = FormBorderStyle.None;
            dispatcher.StartPosition = FormStartPosition.Manual;
            dispatcher.Bounds = new Rectangle(-32000, -32000, 1, 1);
            IntPtr handle = dispatcher.Handle;

            hook = new MouseHook();
            hook.DragCompleted += OnDragCompleted;
            hook.Clicked += OnClicked;
            hook.Install();

            try
            {
                hotkey = HotkeyWindow.TryInstall(handle, out hotkeyLabel);
                if (hotkey != null) hotkey.Pressed += OnHotkey;
            }
            catch (Exception ex)
            {
                Log.Write("hotkey install: " + ex.Message);
                hotkey = null;
                hotkeyLabel = null;
            }

            ContextMenuStrip menu = new ContextMenuStrip();
            menu.Items.Add("翻译当前选区（" + (hotkeyLabel != null ? hotkeyLabel : "快捷键不可用") + "）", null, delegate { OnHotkey(); });
            menu.Items.Add("打开日志", null, delegate
            {
                try { Process.Start("notepad.exe", Path.Combine(Path.GetTempPath(), "whale-desktop.log")); }
                catch { }
            });
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("退出", null, delegate { ExitThread(); });
            tray = new NotifyIcon();
            try
            {
                Icon appIcon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
                tray.Icon = appIcon != null ? appIcon : SystemIcons.Application;
            }
            catch
            {
                tray.Icon = SystemIcons.Application;
            }
            tray.Text = "鲸译 · 划词翻译（spike）";
            tray.ContextMenuStrip = menu;
            tray.Visible = true;
            tray.ShowBalloonTip(1800, "鲸译已启动", "鼠标拖选文字，或选中后按 " + (hotkeyLabel != null ? hotkeyLabel : "托盘菜单") + "。", ToolTipIcon.Info);
            Log.Write("started; hotkey=" + (hotkey != null ? hotkeyLabel : "unavailable"));
        }

        private void OnHotkey()
        {
            CaptureSelection(Cursor.Position, true);
        }

        private void OnDragCompleted(Point point)
        {
            CaptureSelection(point, false);
        }

        private void CaptureSelection(Point point, bool preferFocused)
        {
            Log.Write("capture at " + point + " focused=" + preferFocused);
            ThreadPool.QueueUserWorkItem(delegate
            {
                try
                {
                    Thread.Sleep(90);
                    string text = preferFocused ? SelectionReader.TryReadFocusedUia() : SelectionReader.TryReadUia(point);
                    Log.Write("uia " + (text == null ? "null" : text.Length + " chars"));
                    if (text == null)
                    {
                        BeginOnUi(delegate
                        {
                            string clipboardText = SelectionReader.TryReadClipboard();
                            Log.Write("clipboard " + (clipboardText == null ? "null" : clipboardText.Length + " chars"));
                            if (clipboardText != null) ShowOverlay(clipboardText, point);
                        });
                        return;
                    }
                    BeginOnUi(delegate { ShowOverlay(text, point); });
                }
                catch (Exception ex)
                {
                    Log.Write("capture: " + ex);
                }
            });
        }

        private void OnClicked(Point point)
        {
            if (overlay != null && overlay.Visible && !overlay.Bounds.Contains(point))
            {
                overlay.Hide();
            }
        }

        private void BeginOnUi(Action action)
        {
            try
            {
                if (dispatcher.IsHandleCreated) dispatcher.BeginInvoke(action);
            }
            catch (Exception ex)
            {
                Log.Write("dispatch: " + ex);
            }
        }

        private void ShowOverlay(string text, Point point)
        {
            string trimmed = (text ?? string.Empty).Trim();
            if (trimmed.Length == 0) return;
            if (trimmed.Length > 12000) trimmed = trimmed.Substring(0, 12000);
            if (overlay != null)
            {
                overlay.Dispose();
                overlay = null;
            }
            overlay = new OverlayFormV2(trimmed, point);
            overlay.FormClosed += delegate { overlay = null; };
            overlay.Show();
            Log.Write("overlay: " + trimmed.Length + " chars at " + point);
        }

        protected override void ExitThreadCore()
        {
            try { hook.Dispose(); } catch { }
            try { if (hotkey != null) hotkey.Dispose(); } catch { }
            if (overlay != null) { overlay.Dispose(); overlay = null; }
            if (tray != null) { tray.Visible = false; tray.Dispose(); }
            if (dispatcher != null) { dispatcher.Dispose(); }
            Log.Write("stopped");
            base.ExitThreadCore();
        }
    }

    internal sealed class MouseHook : IDisposable
    {
        private const int WH_MOUSE_LL = 14;
        private const int WM_LBUTTONDOWN = 0x0201;
        private const int WM_LBUTTONUP = 0x0202;

        private delegate IntPtr LowLevelMouseProc(int nCode, IntPtr wParam, IntPtr lParam);

        [StructLayout(LayoutKind.Sequential)]
        private struct POINT
        {
            public int X;
            public int Y;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct MSLLHOOKSTRUCT
        {
            public POINT pt;
            public uint mouseData;
            public uint flags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [DllImport("user32.dll", SetLastError = true)]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelMouseProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool UnhookWindowsHookEx(IntPtr hhk);

        [DllImport("user32.dll")]
        private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("kernel32.dll")]
        private static extern IntPtr GetModuleHandle(string lpModuleName);

        public event Action<Point> DragCompleted;
        public event Action<Point> Clicked;

        private IntPtr hookId = IntPtr.Zero;
        private LowLevelMouseProc proc;
        private Point downPoint;
        private bool hasDown;

        public void Install()
        {
            proc = HookCallback;
            hookId = SetWindowsHookEx(WH_MOUSE_LL, proc, GetModuleHandle(null), 0);
            if (hookId == IntPtr.Zero)
            {
                throw new InvalidOperationException("全局鼠标钩子安装失败，错误码 " + Marshal.GetLastWin32Error());
            }
        }

        private IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
        {
            if (nCode >= 0)
            {
                MSLLHOOKSTRUCT info = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
                Point point = new Point(info.pt.X, info.pt.Y);
                int message = wParam.ToInt32();
                if (message == WM_LBUTTONDOWN)
                {
                    downPoint = point;
                    hasDown = true;
                }
                else if (message == WM_LBUTTONUP)
                {
                    bool dragged = hasDown &&
                        (Math.Abs(point.X - downPoint.X) > 4 || Math.Abs(point.Y - downPoint.Y) > 4);
                    hasDown = false;
                    if (dragged)
                    {
                        Action<Point> drag = DragCompleted;
                        if (drag != null) drag(point);
                    }
                    else
                    {
                        Action<Point> click = Clicked;
                        if (click != null) click(point);
                    }
                }
            }
            return CallNextHookEx(hookId, nCode, wParam, lParam);
        }

        public void Dispose()
        {
            if (hookId != IntPtr.Zero)
            {
                UnhookWindowsHookEx(hookId);
                hookId = IntPtr.Zero;
            }
            proc = null;
        }
    }

    internal sealed class HotkeyWindow : NativeWindow, IDisposable
    {
        private const int WM_HOTKEY = 0x0312;
        private const int HOTKEY_ID = 0x5748;
        private const uint MOD_ALT = 0x0001;
        private const uint MOD_CONTROL = 0x0002;
        private const uint MOD_SHIFT = 0x0004;

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

        [DllImport("user32.dll", SetLastError = true)]
        private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

        public event Action Pressed;

        public HotkeyWindow(IntPtr handle, string label, uint modifiers, uint vk)
        {
            AssignHandle(handle);
            if (!RegisterHotKey(handle, HOTKEY_ID, modifiers, vk))
            {
                int error = Marshal.GetLastWin32Error();
                ReleaseHandle();
                throw new InvalidOperationException("快捷键 " + label + " 注册失败，错误码 " + error);
            }
        }

        public static HotkeyWindow TryInstall(IntPtr handle, out string label)
        {
            string[] labels = new string[] { "Ctrl+Alt+W", "Ctrl+Alt+T", "Ctrl+Shift+Alt+T" };
            uint[] modifiers = new uint[] { MOD_CONTROL | MOD_ALT, MOD_CONTROL | MOD_ALT, MOD_CONTROL | MOD_ALT | MOD_SHIFT };
            uint[] keys = new uint[] { (uint)Keys.W, (uint)Keys.T, (uint)Keys.T };
            for (int index = 0; index < labels.Length; index++)
            {
                try
                {
                    HotkeyWindow window = new HotkeyWindow(handle, labels[index], modifiers[index], keys[index]);
                    label = labels[index];
                    return window;
                }
                catch (Exception ex)
                {
                    Log.Write("hotkey " + labels[index] + ": " + ex.Message);
                }
            }
            label = null;
            return null;
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_HOTKEY && m.WParam.ToInt32() == HOTKEY_ID)
            {
                Action handler = Pressed;
                if (handler != null) handler();
            }
            base.WndProc(ref m);
        }

        public void Dispose()
        {
            try { UnregisterHotKey(Handle, HOTKEY_ID); } catch { }
            try { ReleaseHandle(); } catch { }
        }
    }

    internal static class SelectionReader
    {
        [DllImport("user32.dll")]
        private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

        private const byte VK_CONTROL = 0x11;
        private const byte VK_C = 0x43;
        private const uint KEYEVENTF_KEYUP = 0x0002;

        public static string TryReadUia(Point point)
        {
            try
            {
                Task<string> task = Task.Run<string>(delegate { return ReadUia(point); });
                if (!task.Wait(1500)) return null;
                return task.Result;
            }
            catch (Exception ex)
            {
                Log.Write("uia: " + ex.Message);
                return null;
            }
        }

        public static string TryReadFocusedUia()
        {
            try
            {
                Task<string> task = Task.Run<string>(delegate { return ReadFocusedUia(); });
                if (!task.Wait(1500)) return null;
                return task.Result;
            }
            catch (Exception ex)
            {
                Log.Write("uia-focused: " + ex.Message);
                return null;
            }
        }

        private static string ReadFocusedUia()
        {
            try
            {
                AutomationElement focused = AutomationElement.FocusedElement;
                return ReadElementSelection(focused);
            }
            catch (Exception ex)
            {
                Log.Write("uia-focused-read: " + ex.Message);
                return null;
            }
        }

        private static string ReadUia(Point point)
        {
            try
            {
                AutomationElement element = AutomationElement.FromPoint(new System.Windows.Point(point.X, point.Y));
                return ReadElementSelection(element);
            }
            catch (Exception ex)
            {
                Log.Write("uia-read: " + ex.Message);
            }
            return null;
        }

        private static string ReadElementSelection(AutomationElement element)
        {
            for (int depth = 0; depth < 5 && element != null; depth++)
            {
                try
                {
                    object pattern;
                    if (element.TryGetCurrentPattern(TextPattern.Pattern, out pattern))
                    {
                        TextPattern textPattern = (TextPattern)pattern;
                        TextPatternRange[] ranges = textPattern.GetSelection();
                        if (ranges != null && ranges.Length > 0)
                        {
                            StringBuilder builder = new StringBuilder();
                            foreach (TextPatternRange range in ranges)
                            {
                                string part = range.GetText(-1);
                                if (!string.IsNullOrEmpty(part)) builder.Append(part);
                            }
                            string selected = builder.ToString().Trim();
                            if (selected.Length > 0) return selected;
                        }
                    }
                    element = TreeWalker.ControlViewWalker.GetParent(element);
                }
                catch (Exception ex)
                {
                    Log.Write("uia-walk: " + ex.Message);
                    return null;
                }
            }
            return null;
        }

        public static string TryReadClipboard()
        {
            try
            {
                string oldText = Clipboard.ContainsText() ? Clipboard.GetText() : null;
                SendCtrlC();
                Thread.Sleep(150);
                string selected = Clipboard.ContainsText() ? Clipboard.GetText() : null;
                if (oldText != null)
                {
                    try { Clipboard.SetText(oldText); } catch { }
                }
                if (selected == null) return null;
                selected = selected.Trim();
                if (selected.Length == 0) return null;
                if (oldText != null && selected == oldText) return null;
                return selected;
            }
            catch (Exception ex)
            {
                Log.Write("clipboard: " + ex.Message);
                return null;
            }
        }

        private static void SendCtrlC()
        {
            keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
            keybd_event(VK_C, 0, 0, UIntPtr.Zero);
            keybd_event(VK_C, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        }
    }

    internal sealed class OverlayForm : Form
    {
        private const int WS_EX_NOACTIVATE = 0x08000000;
        private const int WS_EX_TOOLWINDOW = 0x00000080;

        private readonly string selectedText;
        private readonly Point anchor;
        private readonly Label titleLabel;
        private readonly Label directionLabel;
        private readonly Label resultLabel;
        private readonly Label statusLabel;
        private readonly Button translateButton;
        private readonly Button closeButton;
        private readonly Button copyButton;
        private bool translated;

        public OverlayForm(string text, Point point)
        {
            selectedText = text;
            anchor = point;
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.Manual;
            ShowInTaskbar = false;
            TopMost = true;
            BackColor = Color.FromArgb(8, 28, 40);
            ForeColor = Color.White;
            Font = new Font("Microsoft YaHei", 9f, FontStyle.Regular, GraphicsUnit.Point);
            Width = 410;
            Height = 50;
            DoubleBuffered = true;
            SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.UserPaint | ControlStyles.OptimizedDoubleBuffer, true);

            bool chinese = Regex.IsMatch(selectedText, "[\u4e00-\u9fff]");
            titleLabel = new Label();
            titleLabel.Text = "鲸译";
            titleLabel.ForeColor = Color.White;
            titleLabel.Font = new Font("Microsoft YaHei", 11f, FontStyle.Bold, GraphicsUnit.Point);
            titleLabel.Bounds = new Rectangle(16, 9, 54, 26);
            titleLabel.BackColor = Color.Transparent;
            Controls.Add(titleLabel);

            directionLabel = new Label();
            directionLabel.Text = chinese ? "自动检测 · 中文 → English" : "自动检测 · English → 中文";
            directionLabel.ForeColor = Color.FromArgb(143, 198, 210);
            directionLabel.Font = new Font("Microsoft YaHei", 8f, FontStyle.Regular, GraphicsUnit.Point);
            directionLabel.Bounds = new Rectangle(74, 13, 208, 20);
            directionLabel.BackColor = Color.Transparent;
            Controls.Add(directionLabel);

            translateButton = new Button();
            translateButton.Text = "翻译";
            translateButton.Bounds = new Rectangle(Width - 116, 8, 64, 34);
            translateButton.FlatStyle = FlatStyle.Flat;
            translateButton.FlatAppearance.BorderSize = 0;
            translateButton.BackColor = Color.FromArgb(24, 170, 178);
            translateButton.ForeColor = Color.White;
            translateButton.Font = new Font("Microsoft YaHei", 9f, FontStyle.Bold, GraphicsUnit.Point);
            translateButton.Click += TranslateButtonClick;
            Controls.Add(translateButton);

            closeButton = new Button();
            closeButton.Text = "×";
            closeButton.Bounds = new Rectangle(Width - 42, 8, 30, 34);
            closeButton.FlatStyle = FlatStyle.Flat;
            closeButton.FlatAppearance.BorderSize = 0;
            closeButton.BackColor = Color.FromArgb(8, 28, 40);
            closeButton.ForeColor = Color.FromArgb(180, 205, 212);
            closeButton.Font = new Font("Microsoft YaHei", 13f, FontStyle.Regular, GraphicsUnit.Point);
            closeButton.Click += delegate { Hide(); };
            Controls.Add(closeButton);

            resultLabel = new Label();
            resultLabel.Bounds = new Rectangle(16, 60, Width - 32, 150);
            resultLabel.ForeColor = Color.White;
            resultLabel.Font = new Font("Microsoft YaHei", 10f, FontStyle.Regular, GraphicsUnit.Point);
            resultLabel.BackColor = Color.Transparent;
            resultLabel.Visible = false;
            Controls.Add(resultLabel);

            statusLabel = new Label();
            statusLabel.Bounds = new Rectangle(16, Height - 30, 240, 20);
            statusLabel.ForeColor = Color.FromArgb(128, 190, 200);
            statusLabel.Font = new Font("Microsoft YaHei", 8f, FontStyle.Regular, GraphicsUnit.Point);
            statusLabel.BackColor = Color.Transparent;
            statusLabel.Visible = false;
            Controls.Add(statusLabel);

            copyButton = new Button();
            copyButton.Text = "复制译文";
            copyButton.Bounds = new Rectangle(Width - 120, Height - 40, 104, 28);
            copyButton.FlatStyle = FlatStyle.Flat;
            copyButton.FlatAppearance.BorderColor = Color.FromArgb(55, 110, 122);
            copyButton.BackColor = Color.FromArgb(13, 44, 58);
            copyButton.ForeColor = Color.FromArgb(206, 244, 247);
            copyButton.Font = new Font("Microsoft YaHei", 8.5f, FontStyle.Regular, GraphicsUnit.Point);
            copyButton.Visible = false;
            copyButton.Click += delegate
            {
                try
                {
                    Clipboard.SetText(resultLabel.Text);
                    copyButton.Text = "已复制";
                }
                catch { copyButton.Text = "复制失败"; }
            };
            Controls.Add(copyButton);

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

        protected override void OnPaint(PaintEventArgs e)
        {
            base.OnPaint(e);
            using (Pen pen = new Pen(Color.FromArgb(48, 86, 98), 1f))
            {
                e.Graphics.DrawRectangle(pen, 0, 0, Width - 1, Height - 1);
            }
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
                using (GraphicsPath path = new GraphicsPath())
                {
                    int radius = 14;
                    Rectangle rect = new Rectangle(0, 0, Width, Height);
                    path.AddArc(rect.Left, rect.Top, radius, radius, 180, 90);
                    path.AddArc(rect.Right - radius, rect.Top, radius, radius, 270, 90);
                    path.AddArc(rect.Right - radius, rect.Bottom - radius, radius, radius, 0, 90);
                    path.AddArc(rect.Left, rect.Bottom - radius, radius, radius, 90, 90);
                    path.CloseFigure();
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
                Height = 300;
                resultLabel.Visible = true;
                statusLabel.Visible = true;
                statusLabel.Top = Height - 30;
                copyButton.Visible = true;
                copyButton.Top = Height - 40;
                resultLabel.Text = "";
                statusLabel.Text = "正在翻译…";
                translateButton.Text = "…";
                translateButton.Enabled = false;
                PositionNearAnchor();
                try
                {
                    string translation = await Translator.TranslateAsync(selectedText);
                    resultLabel.Text = translation;
                    statusLabel.Text = "BING · 翻译";
                    translateButton.Text = "重试";
                    Log.Write("translated " + selectedText.Length + " chars");
                }
                catch (Exception ex)
                {
                    resultLabel.Text = "翻译失败：" + ex.Message;
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
            translateButton.Text = "…";
            translateButton.Enabled = false;
            statusLabel.Text = "正在翻译…";
            try
            {
                string translation = await Translator.TranslateAsync(selectedText);
                resultLabel.Text = translation;
                statusLabel.Text = "BING · 翻译";
            }
            catch (Exception ex)
            {
                resultLabel.Text = "翻译失败：" + ex.Message;
                statusLabel.Text = "翻译未完成";
            }
            finally
            {
                translateButton.Text = "重试";
                translateButton.Enabled = true;
            }
        }
    }

    internal static class Translator
    {
        public static Task<string> TranslateAsync(string text)
        {
            return Task.Run<string>(delegate { return Translate(text); });
        }

        private static string Translate(string text)
        {
            bool chinese = Regex.IsMatch(text, "[\u4e00-\u9fff]");
            string from = chinese ? "zh-Hans" : "en";
            string to = chinese ? "en" : "zh-Hans";
            string url = "https://edge.microsoft.com/translate/translatetext?to=" + to + "&isEnterpriseClient=false&from=" + from;
            string body = new JavaScriptSerializer().Serialize(new string[] { text });
            byte[] bytes = Encoding.UTF8.GetBytes(body);

            try
            {
                ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
                request.Method = "POST";
                request.ContentType = "application/json";
                request.Accept = "application/json";
                request.UserAgent = "WhaleTranslatorDesktop/0.1";
                request.Timeout = 20000;
                request.ReadWriteTimeout = 20000;
                request.ContentLength = bytes.Length;
                using (Stream stream = request.GetRequestStream())
                {
                    stream.Write(bytes, 0, bytes.Length);
                }
                string json;
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                using (Stream stream = response.GetResponseStream())
                using (StreamReader reader = new StreamReader(stream, Encoding.UTF8))
                {
                    json = reader.ReadToEnd();
                }
                return ParseTranslation(json);
            }
            catch (WebException ex)
            {
                string detail = "";
                if (ex.Response != null)
                {
                    try
                    {
                        using (Stream stream = ex.Response.GetResponseStream())
                        using (StreamReader reader = new StreamReader(stream, Encoding.UTF8))
                        {
                            detail = reader.ReadToEnd();
                        }
                    }
                    catch { }
                }
                if (!string.IsNullOrEmpty(detail))
                {
                    throw new Exception("HTTP 错误：" + detail.Substring(0, Math.Min(160, detail.Length)));
                }
                throw new Exception(ex.Message);
            }
        }

        private static string ParseTranslation(string json)
        {
            JavaScriptSerializer serializer = new JavaScriptSerializer();
            object[] root = serializer.Deserialize<object[]>(json);
            if (root == null || root.Length == 0) throw new Exception("返回为空");
            Dictionary<string, object> first = root[0] as Dictionary<string, object>;
            if (first == null) throw new Exception("返回格式异常");
            object[] translations = first["translations"] as object[];
            if (translations == null || translations.Length == 0) throw new Exception("没有译文");
            Dictionary<string, object> item = translations[0] as Dictionary<string, object>;
            if (item == null) throw new Exception("译文格式异常");
            string result = item["text"] as string;
            if (string.IsNullOrEmpty(result)) throw new Exception("译文为空");
            return result;
        }
    }

    internal static class Log
    {
        private static readonly object Gate = new object();

        public static void Write(string message)
        {
            try
            {
                lock (Gate)
                {
                    string path = Path.Combine(Path.GetTempPath(), "whale-desktop.log");
                    File.AppendAllText(path, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " " + message + "\r\n", Encoding.UTF8);
                }
            }
            catch { }
        }
    }
}
