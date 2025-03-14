#!/usr/bin/env python

import argparse
import csv
import io
import json
import os
import pathlib
import subprocess
from urllib.request import urlopen

repoDir = pathlib.Path(__file__).resolve().parent.parent
langDir = repoDir / "src-js" / "fontra-core" / "assets" / "lang"
assert langDir.is_dir()
localizationJSPath = repoDir / "src-js" / "fontra-core" / "src" / "localization.js"
assert localizationJSPath.is_file()

languagesBlockTemplate = """\
// Don't edit this block, see scripts/rebuild_languages.py
export const languages = [
{languagesList}
];
"""

languageSourceTemplate = """\
// Don't edit this file: it is generated by scripts/rebuild_languages.py
// The strings are maintained here: {url}
export const strings = {{
{stringsBlock}
}};
"""


def prettier(path):
    subprocess.run(
        [
            os.fspath(repoDir / "node_modules" / ".bin" / "prettier"),
            os.fspath(path),
            "--write",
        ],
        check=True,
    )


def jsonDump(s):
    return json.dumps(s, ensure_ascii=False)


def downloadSheet(url):
    print("downloading", url)
    response = urlopen(url)
    data = response.read()
    file = io.StringIO(data.decode("utf-8"))
    reader = csv.reader(file)
    return list(reader)


def main():
    parser = argparse.ArgumentParser(
        description="Script to rebuild the language files from the Google Sheet"
    )
    parser.add_argument(
        "--include-wip",
        help="Include work-in-progress strings that contain this argument "
        "*and* the string 'WIP' in the the first column. The special string 'all' "
        "matches all 'WIP' strings.",
    )
    args = parser.parse_args()
    includeWorkInProgressTag = args.include_wip
    languageSpreadsheetURL = (
        "https://docs.google.com/"
        "spreadsheets/d/1woTU8dZCHJh7yvdk-N1kgQBUj4Sn3SdRsbKgn6ltJQs/"
    )

    rows = downloadSheet(languageSpreadsheetURL + "export?format=csv")

    numHeaders = 5
    headers = rows[:numHeaders]
    assert headers[0][0] == "Go to Documentation", headers[0][0]
    assert headers[1][2] == "English", headers[1][2]
    assert headers[2][2] == "English", headers[2][2]
    assert headers[3][2] == "en", headers[3][2]

    rows = rows[numHeaders:]

    startColumn = 2

    languages = []
    languageStrings = {}

    for columnIndex in range(startColumn, len(headers[1])):
        languageInEnglish = headers[1][columnIndex]
        languageInLanguage = headers[2][columnIndex]
        languageCode = headers[3][columnIndex]
        languageStatus = headers[4][columnIndex]
        assert languageCode
        if not languageStatus.strip():
            continue

        languages.append(
            dict(
                code=languageCode,
                langEn=languageInEnglish,
                langLang=languageInLanguage,
                status=languageStatus,
            )
        )

        languageStrings[languageCode] = strings = {}

        for row in rows:
            includeRow = "WIP" not in row[0] or (
                includeWorkInProgressTag
                and (
                    includeWorkInProgressTag == "all"
                    or includeWorkInProgressTag in row[0]
                )
            )
            if not includeRow:
                continue

            key = row[1]
            if not key.strip():
                continue
            string = row[columnIndex]
            if not string or string == "-":
                string = languageStrings["en"].get(key, "!missing!")
            strings[key] = string

    localizationJSSource = localizationJSPath.read_text(encoding="utf-8")

    languagesList = "\n".join(f"  {jsonDump(langs)}," for langs in languages)
    languagesBlock = languagesBlockTemplate.format(languagesList=languagesList)

    indexStart = localizationJSSource.find(languagesBlock.splitlines()[0])
    assert indexStart > 0
    indexEnd = localizationJSSource.find("];\n", indexStart)
    assert indexEnd > indexStart

    localizationJSSource = (
        localizationJSSource[:indexStart]
        + languagesBlock
        + localizationJSSource[indexEnd + 3 :]
    )

    localizationJSPath.write_text(localizationJSSource, encoding="utf-8")
    prettier(localizationJSPath)

    for languageCode, strings in languageStrings.items():
        languagePath = langDir / f"{languageCode.strip()}.js"
        print("writing", languagePath)
        lines = []
        for k, v in sorted(strings.items()):
            lines.append(f"  {jsonDump(k.strip())}: {jsonDump(v)},")
        stringsBlock = "\n".join(lines)
        languageSource = languageSourceTemplate.format(
            stringsBlock=stringsBlock, url=languageSpreadsheetURL
        )
        languagePath.write_text(languageSource, encoding="utf-8")
        prettier(languagePath)


if __name__ == "__main__":
    main()
