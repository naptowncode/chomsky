# Chomsky

🔐 **Chomsky – A Grammatical Passphrase Generator** 🔐

> _[Colorless green ideas sleep furiously.](#colorless-what-now)_

Chomsky is a passphrase generator modeled on [Chaerea](https://github.com/naptowncode/chaerea) with the same core principles:

1. **People will use the password that works for them.**  
   Obviously.

2. **People remember words and phrases more easily than letters, numbers, and symbols.**  
   (see [xkcd 936 – correct horse battery staple](https://xkcd.com/936/))

3. **People have a hard time choosing things "randomly".**  
   (see [Bad at Entropy](https://www.loper-os.org/bad-at-entropy/manmach.html))

And it adds a another:

4. **People will recognize (and remember) a phrase that is grammatically well-formed.**  
   (see [Well-formedness](https://en.wikipedia.org/wiki/Well-formedness))

This added principle is an unproven assumption. Regardless of how well it works, this approach certainly divides a main word list into smaller lists by part of speech, which requires a longer passphrase to reach the same level of security that Chaerea provides. Safety not guaranteed, your mileage may vary, etc.

---

## The Settings

Default settings are meant to balance security with memorability.

* **Number of words**  
  Default is 5, minimum 3, maximum 6. Longer is more secure but more likely to exceed a system's maximum password length.

* **Separator**  
  Default is `-`, but can be any string up to 4 characters long.

* **Include number**  
  Default is "At the end". Satisfies password systems that require a number.

* **Template (click a slot to change its part of speech)**  
  Default is "adjective adjective noun verb adverb". This should produce a grammatical result most of the time, though not all combinations will. All nouns are plural which should make them in agreement with all the verbs.

* **Word lists**  
  Default is based on the "Short list" from [Chaerea](https://github.com/naptowncode/chaerea), which itself is based on the "3esl" list from the [12dicts](https://wordlist.aspell.net/12dicts-readme/) project that makes lists of common English words by comparing multiple dictionaries. All lists have been filtered to remove a variety of words that could be problematic for one reason or another. 
  * *Plural Nouns* - 8,689 core English nouns. Making nouns plural was a best-effort job and there may be mistakes.
  * *Adjectives* - 3,746 core English adjectives.
  * *Verbs* - 5,786 core English verbs.
  * *Adverbs* - 926 core English adverbs.
  * *Custom* – Paste or upload your own word list. One word per line, no duplicates.

---

## How to Use

1. Clone this repository.
2. Open `index.html` in a browser.
3. Adjust settings in the “Settings” card; passphrase will regenerate automatically.
4. Optionally upload or paste custom word lists via the file upload controls.
5. Copy the resulting phrase with the **Copy** button.
6. Click **Generate Another Passphrase** if you need another.

---

## Files

* `index.html` – user interface and documentation  
* `app.js` – application logic  
* `words-noun.js`, `words-verb.js`, `words-adj.js`, `words-adv.js` – built‑in word lists
* `style.css` – basic styling
* `scripts/`
  * `build_pos_lists.py` – a simple Python script that compiled the built‑in word lists
  * `ref-noun.txt`, `ref-verb.txt`, `ref-adj.txt`, `ref-adv.txt` – exhaustively long part-of-speech reference lists
  * `ref-noun-plurals.json` – a lookup table of nouns to plural forms; a quick and dirty way to get nouns and verbs to agree since base forms of English verbs are almost always the same as their third-person-plural forms
  * `words-shortlist.txt` – source list of common English words

---

## License

Don't like them, don't want them. This project is free and public domain to the extent allowed by law (see [LICENSE](LICENSE)).

That said, be aware that this project was heavily vibe-coded using a variety of models and may contain scraps of whatever copyrighted code those were trained on. Because intellectual property is over, and we're all going to jail.

---

## Colorless What Now??

"[Colorless green ideas sleep furiously](https://en.wikipedia.org/wiki/Colorless_green_ideas_sleep_furiously)," is a sentence by Noam Chomsky that demonstrates how humans can immediately recognize correct grammar even when the combination of words is meaningless. It appears in Chomsky's 1957 book _Syntactic Structures_ which laid the foundation for much of modern linguistics and cognitive science. It also put a big dent in the radical behaviorism of B.F. Skinner and the idea that you can teach kids how to talk by beating them, good riddance to that.

So if your passphrase is nonsense, don't worry; Noam Chomsky knows what you mean.
