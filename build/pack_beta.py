r"""
adol_plan BETA 打包器（/mnt/userdata/adol/ 官方部署线）
=====================================================

包内结构（b7 纯净规范，全部平铺契约，无额外 readme/md5 文本）:
    install.bat     安装脚本（GBK+CRLF，双击运行）
    persist.bat     持久化脚本（GBK+CRLF，配置 /etc/rc 自启）
    uninstall.bat   卸载脚本（GBK+CRLF，清理全部残留恢复原厂）
    files/          平铺 14 个文件（直接推送至 /mnt/userdata/adol/）:
                    - web 4件: index.html, app.js, app.css, favicon.ico
                    - web.md5: web 清单
                    - backend 7件: at_cond, imei_tool, key2simd, ctl.sh, qos.sh, collect.sh, wpa_supplicant
                    - backend.md5: backend 目标清单
                    - beta.sh: 设备端主控脚本（LF+ASCII）

版本命名:
    adol_plan_beta_<YYYYMMDDHHMM>_1.0b<序号>
    接续 b7 后的序号为 b8。

用法:
    python build\pack_beta.py            打包
    python build\pack_beta.py --zip      打包并生成 zip 压缩包
    python build\pack_beta.py --version adol_plan_beta_xxx
"""
import os, sys, re, time, hashlib, shutil, zipfile, argparse

sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)                      # A4milk
RELEASE = os.path.join(os.path.dirname(REPO), "release")
SRC_BETA = os.path.join(REPO, "beta")
SRC_WEB = os.path.join(REPO, "resources", "web")
SRC_RES = os.path.join(REPO, "resources")

WEB_FILES = ["app.css", "app.js", "favicon.ico", "index.html"]
BACKEND = [
    ("at_cond",       "/mnt/userdata/binary/at_cond"),
    ("imei_tool",     "/mnt/userdata/binary/imei_tool"),
    ("key2simd",      "/mnt/userdata/sim_switch/key2simd"),
    ("ctl.sh",        "/mnt/userdata/sim_switch/ctl.sh"),
    ("qos.sh",        "/mnt/userdata/qos/qos.sh"),
    ("collect.sh",    "/mnt/userdata/flux_stat/collect.sh"),
    ("wpa_supplicant","/mnt/userdata/binary/wpa_supplicant"),
]
BATS = ["install", "persist", "uninstall"]
PREFIX = "adol_plan_beta"


def md5(p):
    h = hashlib.md5()
    with open(p, "rb") as f:
        for c in iter(lambda: f.read(1 << 20), b""):
            h.update(c)
    return h.hexdigest()


def _is_ascii(b):
    try:
        b.decode("ascii")
        return True
    except UnicodeDecodeError:
        return False


def check_ascii_text(path):
    data = open(path, "rb").read()
    if not _is_ascii(data):
        raise SystemExit("[失败] %s 含非 ASCII 字节，设备端脚本必须纯 ASCII" % os.path.basename(path))
    return data


def convert_bat(src, dst):
    """UTF-8 源 -> GBK+CRLF 产物；不可编码字符当场失败而不是事后变问号。"""
    text = open(src, encoding="utf-8").read().replace("\r\n", "\n")
    try:
        data = text.encode("gbk")
    except UnicodeEncodeError as e:
        raise SystemExit("[失败] %s 含 GBK 无法编码字符: %s" % (src, e))
    open(dst, "wb").write(data.replace(b"\n", b"\r\n"))


def parse_ver(v):
    m = re.match(r"^%s_(\d{12})_([\d.]+)b(\d+)$" % PREFIX, v)
    if not m:
        return None
    try:
        t = time.strptime(m.group(1), "%Y%m%d%H%M")
        maj = float(m.group(2))
        bn = int(m.group(3))
    except ValueError:
        return None
    return t, maj, bn, m.group(1)


def compute_version(now=None):
    now = now or time.localtime()
    tv = time.strftime("%Y%m%d%H%M", now)
    prev = []
    if os.path.isdir(RELEASE):
        for d in os.listdir(RELEASE):
            p = parse_ver(d)
            if p:
                prev.append((d, p))
    if not prev:
        return "%s_%s_1.0b1" % (PREFIX, tv)
    all_b = [x[1][2] for x in prev]
    rn = (max(all_b) + 1) if all_b else 1
    return "%s_%s_1.0b%d" % (PREFIX, tv, rn)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--version", default=None)
    ap.add_argument("--zip", action="store_true")
    args = ap.parse_args()

    ver = args.version or compute_version()
    final = os.path.join(RELEASE, ver)
    staging = final + ".staging"
    os.makedirs(RELEASE, exist_ok=True)
    if os.path.exists(final):
        print("[错误] 版本目录已存在: %s" % final)
        return 1
    if os.path.exists(staging):
        shutil.rmtree(staging)

    try:
        print("=" * 60)
        print("  adol_plan beta 打包器 -> %s" % ver)
        print("=" * 60)

        # 1) 源检查
        for f in WEB_FILES:
            p = os.path.join(SRC_WEB, f)
            if not os.path.isfile(p):
                raise SystemExit("[失败] web 产物缺失: %s（先在 web/ 执行 npm run build）" % p)
        for f in BATS:
            p = os.path.join(SRC_BETA, "%s.src.bat" % f)
            if not os.path.isfile(p):
                raise SystemExit("[失败] 模板缺失: %s" % p)
        beta_src = os.path.join(SRC_BETA, "beta.sh")
        if not os.path.isfile(beta_src):
            raise SystemExit("[失败] 模板缺失: %s" % beta_src)
        print("[1/4] 源文件就位: web=resources/web/  模板=beta/")

        # 2) 组装 —— 全部平铺进 staging/files（b7 的扁平契约）
        files_dir = os.path.join(staging, "files")
        os.makedirs(files_dir)

        # web 4 件
        for f in WEB_FILES:
            shutil.copy2(os.path.join(SRC_WEB, f), os.path.join(files_dir, f))

        # web.md5
        with open(os.path.join(files_dir, "web.md5"), "w", newline="\n") as fh:
            for f in ["index.html", "app.js", "app.css", "favicon.ico"]:
                fh.write("%s  %s\n" % (md5(os.path.join(SRC_WEB, f)), f))

        # backend 7 件 + backend.md5
        with open(os.path.join(files_dir, "backend.md5"), "w", newline="\n") as fh:
            for fname, target in BACKEND:
                src = os.path.join(SRC_RES, fname)
                if not os.path.isfile(src):
                    raise SystemExit("[失败] 后端资源缺失: resources/%s" % fname)
                data = open(src, "rb").read()
                if fname.endswith(".sh"):
                    data = data.replace(b"\r\n", b"\n")
                    if not _is_ascii(data):
                        raise SystemExit("[失败] %s 含非 ASCII，设备端脚本必须纯 ASCII" % fname)
                open(os.path.join(files_dir, fname), "wb").write(data)
                fh.write("%s  %s\n" % (hashlib.md5(data).hexdigest(), target))

        # beta.sh（LF + 纯 ASCII）放入 files/
        beta_bytes = check_ascii_text(beta_src)
        with open(os.path.join(files_dir, "beta.sh"), "wb") as fh:
            fh.write(beta_bytes.replace(b"\r\n", b"\n"))

        # 三件套 bat：GBK + CRLF 放置在根目录
        for f in BATS:
            convert_bat(os.path.join(SRC_BETA, "%s.src.bat" % f),
                        os.path.join(staging, "%s.bat" % f))

        file_count = len(os.listdir(files_dir))
        root_count = len(BATS)
        print("[2/4] 组装完成（files/ 平铺 %d 件 + 根目录 %d 个文件）" % (file_count, root_count))

        # 3) 自检 + 原子落盘
        items = []
        for dp, dn, fn in os.walk(staging):
            for f in fn:
                items.append(os.path.join(dp, f))
        expected_items = 17
        if len(items) != expected_items:
            raise RuntimeError("预期包内共 %d 个文件，实得 %d" % (expected_items, len(items)))
        for p in items:
            if os.path.getsize(p) == 0:
                raise RuntimeError("发现空文件: %s" % p)

        print("[3/4] 自检通过（共 %d 个文件），原子落盘 %s" % (len(items), final))
        os.rename(staging, final)

        # 4) zip（包内统一顶层目录名 = 版本号）
        if args.zip:
            zp = final + ".zip"
            with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
                for dp, dn, fn in os.walk(final):
                    for f in sorted(fn):
                        p = os.path.join(dp, f)
                        z.write(p, os.path.join(ver, os.path.relpath(p, final)).replace("\\", "/"))
            print("[4/4] zip: %s (%.1f KB)" % (zp, os.path.getsize(zp) / 1024.0))
        else:
            print("[4/4] 跳过 zip 压缩（未传 --zip）")

        print("\n完成。版本目录: %s" % final)
        return 0
    except Exception as e:
        import traceback
        print("\n[失败] %s" % e)
        traceback.print_exc()
        if os.path.exists(staging):
            shutil.rmtree(staging)
        return 1


if __name__ == "__main__":
    sys.exit(main())
