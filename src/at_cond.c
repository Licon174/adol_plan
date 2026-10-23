#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <unistd.h>
#include <errno.h>
#include <signal.h>
#include <setjmp.h>
#include <fcntl.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/socket.h>
#include <sys/select.h>
#include <netinet/in.h>
#include <arpa/inet.h>

#define DEF_PORT     2048
#define REQ_MAX      2048
#define CMD_MAX      240
#define RSP_MAX      1024
#define CALL_TIMEOUT 8

#define LOG_DIR      "/mnt/userdata/binary/logs"
#define LOG_PATH     LOG_DIR "/at_cond.log"
#define LOG_PID      LOG_DIR "/at_cond.pid"

#define LOG_CAP      8192

#define GUARD_HDR    "x-at-console"
#define GUARD_VAL    "1"
#define RAW_MARK     "recv MSG_CMD_SEND_AT_MSG_RSP, buf:"

extern int get_modem_info(const char *cmd, char *r, int n);

static void write_pid(void);
static void attach_log(void);
static int  stop_svc(void);

static sigjmp_buf g_jb;
static volatile sig_atomic_t g_in_call = 0;
static int   g_logr = -1;
static off_t g_logpos = 0;
static const char *g_cors = 0;

static void on_alarm(int s) { (void)s; if (g_in_call) siglongjmp(g_jb, 1); }

static void wout(int fd, const char *s, int n)
{
    int off = 0, r;
    while (off < n) {
        r = (int)write(fd, s + off, n - off);
        if (r <= 0) { if (errno == EINTR) continue; return; }
        off += r;
    }
}
static void ws(int fd, const char *s) { wout(fd, s, (int)strlen(s)); }

static void wnum(int fd, long v)
{
    char b[24]; int n = 0, i; char t;
    if (v < 0) { ws(fd, "-"); v = -v; }
    if (v == 0) { ws(fd, "0"); return; }
    while (v) { b[n++] = (char)('0' + v % 10); v /= 10; }
    for (i = 0; i < n / 2; i++) { t = b[i]; b[i] = b[n - 1 - i]; b[n - 1 - i] = t; }
    b[n] = 0;
    ws(fd, b);
}

static void reply(int fd, const char *status, const char *ctype, const char *body, int len)
{
    if (len < 0) len = (int)strlen(body);
    ws(fd, "HTTP/1.1 "); ws(fd, status); ws(fd, "\r\n");
    ws(fd, "Content-Type: "); ws(fd, ctype); ws(fd, "\r\n");
    ws(fd, "Content-Length: "); wnum(fd, len); ws(fd, "\r\n");
    ws(fd, "Cache-Control: no-store\r\n");
    if (g_cors) {
        ws(fd, "Access-Control-Allow-Origin: "); ws(fd, g_cors); ws(fd, "\r\n");
        ws(fd, "Access-Control-Allow-Methods: GET, OPTIONS\r\n");
        ws(fd, "Access-Control-Allow-Headers: X-AT-Console, Content-Type\r\n");
        ws(fd, "Vary: Origin\r\n");
    }
    ws(fd, "Connection: close\r\n\r\n");
    if (len) wout(fd, body, len);
}

static int hdr_get(const char *req, const char *name, char *out, int outmax)
{
    int nlen = (int)strlen(name);
    const char *p = req;
    int i;
    out[0] = 0;
    while ((p = strchr(p, '\n')) != 0) {
        p++;
        if (strncasecmp(p, name, nlen) != 0) continue;
        if (p[nlen] != ':') continue;
        p += nlen + 1;
        while (*p == ' ' || *p == '\t') p++;
        for (i = 0; i < outmax - 1 && p[i] && p[i] != '\r' && p[i] != '\n'; i++) out[i] = p[i];
        out[i] = 0;
        return 1;
    }
    return 0;
}

static int daemonize(void)
{
    int pfd[2];
    pid_t p;
    int fd;
    char c = 0;
    ssize_t r;

    if (pipe(pfd) != 0) return 1;
    p = fork();
    if (p < 0) { close(pfd[0]); close(pfd[1]); return 1; }

    if (p > 0) {
        close(pfd[1]);
        r = read(pfd[0], &c, 1);
        close(pfd[0]);
        if (r != 1) return 1;
        _exit(0);
    }

    close(pfd[0]);
    setsid();
    chdir("/");
    fd = open("/dev/null", O_RDONLY);
    if (fd >= 0) { dup2(fd, 0); close(fd); }
    attach_log();
    { ssize_t w = write(pfd[1], "1", 1); (void)w; }
    close(pfd[1]);
    return 0;
}

static void write_pid(void)
{
    int fd = open(LOG_PID, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    char b[24];
    int n;
    if (fd < 0) return;
    n = snprintf(b, sizeof b, "%d\n", (int)getpid());
    if (n > 0) { ssize_t w = write(fd, b, (size_t)n); (void)w; }
    close(fd);
}

static void attach_log(void)
{
    int fd = open(LOG_PATH, O_WRONLY | O_CREAT | O_APPEND, 0644);
    if (fd < 0) return;
    dup2(fd, 1);
    dup2(fd, 2);
    close(fd);
    write_pid();
}

static int stop_svc(void)
{
    char b[32];
    int fd = open(LOG_PID, O_RDONLY);
    int n, pid;
    if (fd < 0) return 1;
    n = (int)read(fd, b, sizeof b - 1);
    close(fd);
    if (n <= 0) return 1;
    b[n] = 0;
    pid = atoi(b);
    if (pid > 1) { kill((pid_t)pid, SIGTERM); kill((pid_t)pid, SIGKILL); }
    unlink(LOG_PID);
    return 0;
}

static int urldecode(const char *src, int srclen, char *dst, int dstmax)
{
    int i, o = 0;
    for (i = 0; i < srclen && o < dstmax - 1; i++) {
        char c = src[i];
        if (c == '%' && i + 2 < srclen) {
            int h1 = src[i + 1], h2 = src[i + 2], v = 0, bad = 0;
            if (h1 >= '0' && h1 <= '9') v = (h1 - '0') << 4;
            else if (h1 >= 'a' && h1 <= 'f') v = (h1 - 'a' + 10) << 4;
            else if (h1 >= 'A' && h1 <= 'F') v = (h1 - 'A' + 10) << 4;
            else bad = 1;
            if (!bad) {
                if (h2 >= '0' && h2 <= '9') v |= (h2 - '0');
                else if (h2 >= 'a' && h2 <= 'f') v |= (h2 - 'a' + 10);
                else if (h2 >= 'A' && h2 <= 'F') v |= (h2 - 'A' + 10);
                else bad = 1;
            }
            if (bad) { dst[o++] = c; continue; }
            dst[o++] = (char)v;
            i += 2;
        } else if (c == '+') {
            dst[o++] = ' ';
        } else {
            dst[o++] = c;
        }
    }
    dst[o] = 0;
    return o;
}

static int qget(const char *qs, const char *key, char *out, int outmax)
{
    int klen = (int)strlen(key);
    const char *p = qs;
    while (p && *p) {
        const char *amp = strchr(p, '&');
        int seglen = amp ? (int)(amp - p) : (int)strlen(p);
        const char *eq = memchr(p, '=', seglen);
        if (eq && (int)(eq - p) == klen && strncmp(p, key, klen) == 0) {
            urldecode(eq + 1, seglen - (int)(eq - p) - 1, out, outmax);
            return 1;
        }
        p = amp ? amp + 1 : 0;
    }
    return 0;
}

static int tidy_rsp(char *b, int n)
{
    int i, o = 0, nl = 0, s;
    for (i = 0; i < n; i++) {
        char c = b[i];
        if (c == '\r') continue;
        if (c == '\n') { if (++nl > 1) continue; b[o++] = '\n'; }
        else { nl = 0; b[o++] = c; }
    }
    s = 0;
    while (s < o && (b[s] == '\n' || b[s] == ' ' || b[s] == '\t')) s++;
    if (s) { memmove(b, b + s, (size_t)(o - s)); o -= s; }
    while (o > 0 && (b[o - 1] == '\n' || b[o - 1] == ' ' || b[o - 1] == '\t')) o--;
    b[o] = 0;
    return o;
}

static int grab_raw_rsp(char *out, int outmax)
{
    char tail[2048];
    const char *p, *end;
    int n;
    if (g_logr < 0) return -1;
    if (lseek(g_logr, g_logpos, SEEK_SET) < 0) return -1;
    n = (int)read(g_logr, tail, sizeof tail - 1);
    if (n <= 0) return -1;
    tail[n] = 0;
    p = strstr(tail, RAW_MARK);
    if (!p) {
        if (n >= (int)sizeof tail - 1) g_logpos += n;
        return -1;
    }
    g_logpos += n;
    p += strlen(RAW_MARK);
    end = strstr(p, "\n[net][");
    if (!end) end = p + strlen(p);
    n = (int)(end - p);
    if (n <= 0) return -1;
    if (n > outmax - 1) n = outmax - 1;
    memcpy(out, p, (size_t)n);
    out[n] = 0;
    return tidy_rsp(out, n);
}

static void log_roll_if_needed(void)
{
    int fd;
    if (g_logpos < (off_t)LOG_CAP) return;
    fflush(NULL);
    fd = open(LOG_PATH, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd < 0) return;
    dup2(fd, 1);
    dup2(fd, 2);
    close(fd);
    g_logpos = 0;
    if (g_logr >= 0) lseek(g_logr, 0, SEEK_SET);
}

#define AT_ERR_BADCMD   (-1001)
#define AT_ERR_TIMEOUT  (-1002)

static int run_at(const char *cmd, char *rsp, int rspmax, int *timed_out)
{
    char line[CMD_MAX + 4];
    int n, rc, j;
    *timed_out = 0;
    n = (int)strlen(cmd);
    if (n <= 0 || n > CMD_MAX) return AT_ERR_BADCMD;
    if ((cmd[0] != 'A' && cmd[0] != 'a') || (cmd[1] != 'T' && cmd[1] != 't'))
        return AT_ERR_BADCMD;
    for (j = 0; j < n; j++) {
        if (cmd[j] == '\r' || cmd[j] == '\n') return AT_ERR_BADCMD;
    }
    memcpy(line, cmd, n);
    line[n] = '\r'; line[n + 1] = '\n'; line[n + 2] = 0;

    memset(rsp, 0, rspmax);
    if (g_logr >= 0) g_logpos = lseek(g_logr, 0, SEEK_END);

    g_in_call = 1;
    if (sigsetjmp(g_jb, 1) == 0) {
        alarm(CALL_TIMEOUT);
        rc = get_modem_info(line, rsp, rspmax);
        alarm(0);
        g_in_call = 0;
        fflush(0);
        rsp[rspmax - 1] = 0;
        if (rsp[0] == 0) {
            for (j = 0; j < 5; j++) {
                if (grab_raw_rsp(rsp, rspmax) > 0) break;
                usleep(30000);
            }
        }
        log_roll_if_needed();
        return rc;
    }
    g_in_call = 0;
    alarm(0);
    *timed_out = 1;
    log_roll_if_needed();
    return AT_ERR_TIMEOUT;
}

static void serve(int cfd)
{
    char req[REQ_MAX + 1];
    char path[256], qs[512], rsp[RSP_MAX];
    char host[128], origin[256], guard[32], goform[64], cmd[CMD_MAX + 4];
    int n, timed_out = 0, rc;
    const char *sp, *sp2, *qmark, *p;

    g_cors = 0;
    host[0] = 0; origin[0] = 0; path[0] = 0; qs[0] = 0;
    {
        struct timeval rtv;
        rtv.tv_sec = 2; rtv.tv_usec = 0;
        setsockopt(cfd, SOL_SOCKET, SO_RCVTIMEO, &rtv, sizeof rtv);
    }

    n = (int)read(cfd, req, REQ_MAX);
    if (n <= 0) return;
    req[n] = 0;

    sp = strchr(req, ' ');
    if (!sp) { reply(cfd, "400 Bad Request", "text/plain", "bad request\n", -1); return; }
    p = sp + 1;
    sp2 = strchr(p, ' ');
    n = sp2 ? (int)(sp2 - p) : (int)strlen(p);
    qmark = memchr(p, '?', n);
    if (qmark) {
        int poff = (int)(qmark - p);
        if (poff > (int)sizeof(path) - 1) poff = (int)sizeof(path) - 1;
        memcpy(path, p, poff); path[poff] = 0;
        {
            int qlen = n - poff - 1;
            if (qlen > (int)sizeof(qs) - 1) qlen = (int)sizeof(qs) - 1;
            memcpy(qs, qmark + 1, qlen); qs[qlen] = 0;
        }
    } else {
        int l = n > (int)sizeof(path) - 1 ? (int)sizeof(path) - 1 : n;
        memcpy(path, p, l); path[l] = 0;
    }

    hdr_get(req, "host", host, sizeof host);
    hdr_get(req, "origin", origin, sizeof origin);

    if (origin[0]) {
        const char *os = strstr(origin, "://");
        char oh[128], hh[128];
        int k;
        os = os ? os + 3 : origin;
        for (k = 0; os[k] && os[k] != ':' && os[k] != '/' && k < (int)sizeof(oh) - 1; k++) oh[k] = os[k];
        oh[k] = 0;
        for (k = 0; host[k] && host[k] != ':' && k < (int)sizeof(hh) - 1; k++) hh[k] = host[k];
        hh[k] = 0;
        if (oh[0] && hh[0] && strcasecmp(oh, hh) == 0) g_cors = origin;
    }

    if (strncmp(req, "OPTIONS ", 8) == 0) { reply(cfd, "204 No Content", "text/plain", "", 0); return; }
    if (strncmp(req, "GET ", 4) != 0) { reply(cfd, "405 Method Not Allowed", "text/plain", "use GET\n", -1); return; }

    if (strcmp(path, "/ping") == 0) {
        reply(cfd, "200 OK", "text/plain; charset=utf-8", "at_cond alive\n", -1);
        return;
    }
    if (strcmp(path, "/goform/goform_set_cmd_process") != 0) {
        reply(cfd, "404 Not Found", "text/plain; charset=utf-8", "not found\n", -1);
        return;
    }

    if (!hdr_get(req, GUARD_HDR, guard, sizeof guard) || strcmp(guard, GUARD_VAL) != 0) {
        reply(cfd, "403 Forbidden", "text/plain; charset=utf-8", "missing X-AT-Console header\n", -1);
        return;
    }
    goform[0] = 0; cmd[0] = 0;
    if (!qget(qs, "goformId", goform, sizeof goform) ||
        strcmp(goform, "EXECUTE_AT_COMMAND") != 0) {
        reply(cfd, "400 Bad Request", "text/plain; charset=utf-8", "expect goformId=EXECUTE_AT_COMMAND\n", -1);
        return;
    }
    if (!qget(qs, "at_cmd", cmd, sizeof cmd) || cmd[0] == 0) {
        reply(cfd, "400 Bad Request", "text/plain; charset=utf-8", "missing at_cmd\n", -1);
        return;
    }

    rc = run_at(cmd, rsp, sizeof rsp, &timed_out);
    if (timed_out) {
        reply(cfd, "504 Gateway Timeout", "text/plain; charset=utf-8", "modem timeout (no reply in 8s)\n", -1);
        return;
    }
    if (rc == AT_ERR_BADCMD) {
        reply(cfd, "400 Bad Request", "text/plain; charset=utf-8",
              "command must start with AT and be <= 240 bytes\n", -1);
        return;
    }
    if (rsp[0] == 0) {
        reply(cfd, "502 Bad Gateway", "text/plain; charset=utf-8", "empty response from modem\n", -1);
        return;
    }
    reply(cfd, "200 OK", "text/plain; charset=utf-8", rsp, -1);
}

int main(int argc, char **argv)
{
    int port = DEF_PORT, sfd, one = 1, bg = 0, i;
    struct sockaddr_in sa;
    struct sigaction act;

    for (i = 1; i < argc; i++) {
        if (strcmp(argv[i], "-b") == 0) { bg = 1; continue; }
        if (strcmp(argv[i], "-s") == 0) return stop_svc();
        { int p = atoi(argv[i]); if (p > 0 && p <= 65535) port = p; }
    }

    memset(&act, 0, sizeof act);
    act.sa_handler = on_alarm;
    sigemptyset(&act.sa_mask);
    sigaction(SIGALRM, &act, 0);
    signal(SIGPIPE, SIG_IGN);

    mkdir(LOG_DIR, 0755);

    sfd = socket(AF_INET, SOCK_STREAM, 0);
    if (sfd < 0) return 1;
    setsockopt(sfd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof one);
    memset(&sa, 0, sizeof sa);
    sa.sin_family = AF_INET;
    sa.sin_addr.s_addr = htonl(INADDR_ANY);
    sa.sin_port = htons((unsigned short)port);
    if (bind(sfd, (struct sockaddr *)&sa, sizeof sa) < 0) return 1;
    if (listen(sfd, 8) < 0) return 1;

    if (bg) { if (daemonize() != 0) return 1; }
    else attach_log();

    g_logr = open(LOG_PATH, O_RDONLY);
    if (g_logr >= 0) g_logpos = lseek(g_logr, 0, SEEK_END);

    for (;;) {
        fd_set rf;
        struct timeval tv;
        FD_ZERO(&rf);
        FD_SET(sfd, &rf);
        tv.tv_sec = 1; tv.tv_usec = 0;
        if (select(sfd + 1, &rf, 0, 0, &tv) > 0 && FD_ISSET(sfd, &rf)) {
            int cfd = accept(sfd, 0, 0);
            if (cfd >= 0) { serve(cfd); close(cfd); }
        }
    }
    return 0;
}
