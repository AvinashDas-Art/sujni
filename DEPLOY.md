# सुजनी को मुफ़्त में लाइव करें

लक्ष्य: **₹0 ख़र्च**, कोई कार्ड नहीं, कोई पेड होस्टिंग नहीं। साइट पूरी तरह स्टैटिक है, इसलिए GitHub Pages काफ़ी है।

## 1. GitHub Pages (अभी सेट हो चुका है)

- रिपो: `https://github.com/AvinashDas-Art/sujni`
- अस्थायी लाइव यूआरएल: **https://avinashdas-art.github.io/sujni/**
- सोर्स: `main` ब्रांच; प्रकाशन: `gh-pages` ब्रांच
- हर बार बदलाव के बाद:

```bash
npm run build
npm run check
# dist/ को gh-pages पर भेजें
cd dist
git add -A && git commit -m "publish: $(date +%F)" && git push origin gh-pages
```

या GitHub Actions वर्कफ़्लो `.github/workflows/publish.yml` का `Run workflow` दबाएँ।

## 2. sujni.com को GitHub Pages से जोड़ें

डोमेन अभी **GoDaddy** पर है और पार्किंग IP (`3.33.130.190`, `15.197.148.33`) पर चल रहा है। DNS बदलना ज़रूरी है — यह काम आपके GoDaddy खाते से होगा (मैं आपके रजिस्ट्रार खाते में लॉगिन नहीं कर सकता)।

GoDaddy → **My Products → sujni.com → DNS** में:

### Apex `sujni.com` — पुराने A रिकॉर्ड हटाएँ, ये चार जोड़ें

| Type | Name | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

### IPv6 (अच्छा अभ्यास; न हो तो छोड़ सकते हैं)

| Type | Name | Value |
|---|---|---|
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |

### `www`

| Type | Name | Value |
|---|---|---|
| CNAME | www | AvinashDas-Art.github.io |

फिर GitHub → repo `sujni` → **Settings → Pages**:

1. Custom domain: `sujni.com`
2. Save (GitHub `CNAME` फ़ाइल बना देगा)
3. **Enforce HTTPS** चालू करें (सर्टिफ़िकेट में 15–60 मिनट लग सकते हैं)
4. DNS प्रचार में 30 मिनट–24 घंटे लग सकते हैं

जाँच:

```bash
dig +short sujni.com A
curl -I https://sujni.com
```

### ज़रूरी बात

Custom domain सेट करने से पहले `CNAME` फ़ाइल न बनाएँ, वरना `github.io` URL भी `sujni.com` पर भेज देगा — और DNS बदलने तक वह पार्किंग पेज दिखाएगा।

अगर DNS बदलने के बाद बिल्ड में CNAME चाहिए:

```bash
CUSTOM_DOMAIN=sujni.com npm run build
```

(यह सुविधा बिल्ड में जोड़ी गई है।)

## 3. ईमेल (मुफ़्त)

`sampadak@sujni.com` के लिए दो मुफ़्त रास्ते:

- **Cloudflare Email Routing** — डोमेन के nameservers Cloudflare पर ले जाएँ, फिर Email Routing में free forwarding से अपने Gmail पर भेजें।
- **GoDaddy Email Forwarding** — अगर आपके प्लान में शामिल है तो सीधे forwarding सेट करें।

अगर अभी ईमेल नहीं है, तो साइट पर दिया पता काम नहीं करेगा; बेहतर है पहले forwarding सेट करें।

## 4. रोज़ का काम

```bash
npm run gather   # 15 फ़ीड → data/inbox/YYYY-MM-DD.md (संपादकीय शॉर्टलिस्ट)
```

`.github/workflows/desk.yml` रोज़ सुबह 05:45 IST पर यह शॉर्टलिस्ट आर्टिफ़ैक्ट के तौर पर तैयार करता है। फिर संपादक 4–6 टुकड़े चुनकर `content/edition.mjs` में सार जोड़ता है, `npm run build` चलाता है, और साइट अपडेट हो जाती है। यह काम जानबूझकर हाथ में है — सार ग़लत या सतही न हों, इसलिए।

## 5. Cloudflare Pages (विकल्प, अगर GitHub से ज़्यादा स्पीड चाहिए)

- Cloudflare Pages में repo कनेक्ट करें
- Build command: `npm run build`
- Output directory: `dist`
- Custom domain: `sujni.com`
- Free plan, unlimited bandwidth (fair use)

लेकिन इसके लिए nameservers Cloudflare पर ले जाने पड़ेंगे; तब GoDaddy DNS वाले A रिकॉर्ड हट जाएँगे। दोनों एक साथ न करें।
