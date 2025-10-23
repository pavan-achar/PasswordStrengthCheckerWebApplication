// --- small list of common passwords (not exhaustive) ---
const COMMON = new Set([
    "123456", "123456789", "qwerty", "password", "1234567", "12345678", "12345", "111111",
    "123123", "abc123", "password1", "iloveyou", "admin", "welcome", "monkey", "letmein"
]);

// keyboard patterns and sequences we check for (partial)
const commonSequences = [
    "0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm"
];

// Helper: detect sequences
function hasSequentialChars(s, minLen = 4) {
    s = s.toLowerCase();
    const n = s.length;
    if (n < minLen) return false;
    for (let i = 0; i <= n - minLen; i++) {
        for (let L = minLen; L <= n - i; L++) {
            const sub = s.slice(i, i + L);
            for (const seq of commonSequences) {
                if (seq.includes(sub) || seq.includes([...sub].reverse().join(''))) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Helper: detect repeated characters
function hasRepeatedChars(s, minRepeat = 4) {
    const re = new RegExp('(.)\\1{' + (minRepeat - 1) + ',}');
    return re.test(s);
}

// compute char pool size
function poolSize(s) {
    let size = 0;
    if (/[a-z]/.test(s)) size += 26;
    if (/[A-Z]/.test(s)) size += 26;
    if (/[0-9]/.test(s)) size += 10;
    if (/[^A-Za-z0-9]/.test(s)) size += 32; // rough estimate of printable symbols
    return size || 0;
}

// entropy estimate (bits) = length * log2(pool)
function entropyBits(s) {
    const pool = poolSize(s);
    if (pool === 0) return 0;
    return s.length * Math.log2(pool);
}

// small function to clamp
function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}

// evaluate password and return object {entropy, score(0-100), rating, suggestions, flags}
function evaluatePassword(pwd) {
    const trimmed = pwd || "";
    const bits = Math.round(entropyBits(trimmed) * 10) / 10; // show one decimal
    const flags = {
        isCommon: COMMON.has(trimmed.toLowerCase()),
        repeated: hasRepeatedChars(trimmed),
        sequential: hasSequentialChars(trimmed),
        length: trimmed.length,
        classes: {
            lower: /[a-z]/.test(trimmed),
            upper: /[A-Z]/.test(trimmed),
            digits: /[0-9]/.test(trimmed),
            symbols: /[^A-Za-z0-9]/.test(trimmed)
        }
    };

    // base score from entropy (map entropy to 0..100)
    // 0 bits => 0, 60+ bits => 100 (60 bits is strong)
    let base = clamp((bits / 60) * 100, 0, 100);

    // penalties
    if (flags.isCommon) base *= 0.15;
    if (flags.repeated) base *= 0.6;
    if (flags.sequential) base *= 0.7;
    if (trimmed.length < 8) base *= 0.7;

    // small bonus for mixed classes
    const classesCount = Object.values(flags.classes).filter(Boolean).length;
    if (classesCount >= 3) base = Math.min(100, base + 6);
    if (classesCount === 4) base = Math.min(100, base + 6);

    const score = Math.round(base);
    let rating = "Very Weak";
    if (score >= 85) rating = "Excellent";
    else if (score >= 70) rating = "Strong";
    else if (score >= 50) rating = "Moderate";
    else if (score >= 30) rating = "Weak";

    // suggestions
    const suggestions = [];
    if (flags.isCommon) suggestions.push("Avoid common passwords (e.g., '123456', 'password'). Use unique passphrases or random strings.");
    if (flags.length < 12) suggestions.push("Increase length to 12+ characters — length multiplies strength.");
    if (!flags.classes.lower) suggestions.push("Add lowercase letters.");
    if (!flags.classes.upper) suggestions.push("Add uppercase letters.");
    if (!flags.classes.digits) suggestions.push("Add digits (0-9).");
    if (!flags.classes.symbols) suggestions.push("Include symbols (e.g., !@#$%).");
    if (flags.repeated) suggestions.push("Avoid long repeated characters like 'aaaa' or '1111'.");
    if (flags.sequential) suggestions.push("Avoid simple sequences like 'abcd', '1234', or keyboard patterns like 'qwerty'.");
    if (suggestions.length === 0) suggestions.push("Looks good — consider using a memorable passphrase or a password manager to store it.");

    return {
        entropy: bits,
        score,
        rating,
        suggestions,
        flags,
        classesCount
    };
}

// update UI helpers
const pwdEl = document.getElementById('pwd');
const meterFill = document.getElementById('meterFill');
const ratingEl = document.getElementById('rating');
const entropyEl = document.getElementById('entropy');
const suggestionsEl = document.getElementById('suggestions');
const copyBtn = document.getElementById('copyPwd');
const toggleBtn = document.getElementById('toggleVisibility');
const genBtn = document.getElementById('generate');
const commonBadge = document.getElementById('commonBadge');

function render(pwd) {
    const res = evaluatePassword(pwd);

    // meter width
    meterFill.style.width = res.score + '%';

    // dynamic color: adjust gradient stops via background (approx)
    if (res.score < 30) {
        meterFill.style.background = "linear-gradient(90deg,var(--danger), #f97316)";
    } else if (res.score < 50) {
        meterFill.style.background = "linear-gradient(90deg,#f97316, var(--warning))";
    } else if (res.score < 70) {
        meterFill.style.background = "linear-gradient(90deg,var(--warning), #60a5fa)";
    } else {
        meterFill.style.background = "linear-gradient(90deg,#34d399, var(--good))";
    }

    ratingEl.innerHTML = `Strength: <strong>${res.rating} (${res.score}%)</strong>`;
    entropyEl.innerHTML = `Entropy: <strong>${res.entropy} bits</strong>`;

    // suggestions list
    let html = "<strong>Suggestions</strong>";
    html += "<ul class='slist'>";
    for (const s of res.suggestions) {
        html += "<li>" + escapeHtml(s) + "</li>";
    }
    html += "</ul>";
    suggestionsEl.innerHTML = html;

    // common badge
    if (res.flags.isCommon) {
        commonBadge.style.display = "inline-block";
        commonBadge.textContent = "Common password";
    } else {
        commonBadge.style.display = "none";
    }
}

// escape plaintext for HTML
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// wire events
pwdEl.addEventListener('input', (e) => render(e.target.value));
pwdEl.addEventListener('paste', (e) => {
    // slight delay for pasted content
    setTimeout(() => render(pwdEl.value), 50);
});

toggleBtn.addEventListener('click', () => {
    const cur = pwdEl.getAttribute('type') === 'password' ? 'password' : 'text';
    if (cur === 'password') {
        pwdEl.setAttribute('type', 'text');
        toggleBtn.textContent = 'Hide';
        toggleBtn.setAttribute('aria-pressed', 'true');
    } else {
        pwdEl.setAttribute('type', 'password');
        toggleBtn.textContent = 'Show';
        toggleBtn.setAttribute('aria-pressed', 'false');
    }
});

copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(pwdEl.value);
        copyBtn.textContent = 'Copied!';
        setTimeout(() => copyBtn.textContent = 'Copy', 1600);
    } catch (err) {
        copyBtn.textContent = 'Copy (fail)';
        setTimeout(() => copyBtn.textContent = 'Copy', 1600);
    }
});

// secure random generator for password
function generatePassword(options = { length: 16 }) {
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "0123456789";
    const symbols = "!@#$%^&*()-_=+[]{};:,.<>?/|";
    const all = lower + upper + digits + symbols;
    const out = [];

    // ensure at least 1 char of each type for strong
    out.push(randomFrom(lower));
    out.push(randomFrom(upper));
    out.push(randomFrom(digits));
    out.push(randomFrom(symbols));

    for (let i = out.length; i < options.length; i++) {
        out.push(randomFrom(all));
    }

    // shuffle
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(cryptoRandom() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }

    return out.join('');
}

function randomFrom(str) {
    return str[Math.floor(cryptoRandom() * str.length)];
}

function cryptoRandom() {
    return window.crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF;
}

genBtn.addEventListener('click', () => {
    const pwd = generatePassword({ length: 18 });
    pwdEl.value = pwd;
    render(pwd);
});

// initial render empty
render('');

// accessibility: focus management for keyboard users
document.addEventListener('keydown', (e) => {
    if (e.key === 'G' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        genBtn.click();
    }
});

// Basic tests (run on load) - logs, not visible to user
(function runSanityTests() {
    // ensure evaluatePassword returns increasing score for stronger passwords
    const a = evaluatePassword("password");
    const b = evaluatePassword("Password123!");
    const c = evaluatePassword("sTr0ng!LongPassphrase2024$");
    console.log("sanity scores:", a.score, b.score, c.score);
    // Expect a < b < c
})();