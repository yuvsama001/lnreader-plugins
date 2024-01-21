import { load as parseHTML } from "cheerio";
import { fetchApi, fetchFile } from "@libs/fetch";
import { Filters, FilterTypes } from "@libs/filterInputs";
import { Plugin } from "@typings/plugin";

class NovelUpdates implements Plugin.PluginBase {
    id = "novelupdates";
    name = "Novel Updates";
    version = "0.5.0";
    icon = "src/en/novelupdates/icon.png";
    site = "https://www.novelupdates.com/";
    baseUrl = this.site;

    getPopularNovelsUrl(
        page: number,
        { showLatestNovels, filters }: Plugin.PopularNovelsOptions<Filters>
    ) {
        let url = `${this.baseUrl}${filters
            ? "series-finder"
            : showLatestNovels
                ? "latest-series"
                : "series-ranking"
            }/`;

        if (!filters) {
            url += "?rank=week";
        } else {
            url += "?sf=1";
        }

        if (filters) {
            if (Array.isArray(filters.novelType) && filters.novelType?.length) {
                url += "&nt=" + filters?.novelType.join(",");
            }

            if (Array.isArray(filters.genres) && filters.genres?.length) {
                url += "&gi=" + filters?.genres.join(",") + "&mgi=and";
            }

            if (Array.isArray(filters.language) && filters.language?.length) {
                url += "&org=" + filters?.language.join(",");
            }

            if (filters.storyStatus) {
                url += "&ss=" + filters?.storyStatus;
            }
        }

        if (!filters?.sort) {
            url += "&sort=" + "sdate";
        } else {
            url += "&sort=" + filters?.sort;
        }

        if (!filters?.order) {
            url += "&order=" + "desc";
        } else {
            url += "&order=" + filters?.order;
        }

        return url;
    }

    async popularNovels(pageNo: number, { showLatestNovels, filters }: Plugin.PopularNovelsOptions<Filters>): Promise<Plugin.NovelItem[]> {
        const url = this.getPopularNovelsUrl(pageNo, { showLatestNovels, filters });

        const result = await fetchApi(url);
        const body = await result.text();

        const loadedCheerio = parseHTML(body);

        const novels: Plugin.NovelItem[] = [];

        loadedCheerio("div.search_main_box_nu").each((idx, ele) => {
            const novelCover = loadedCheerio(ele).find("img").attr("src");
            const novelName = loadedCheerio(ele).find(".search_title > a").text();
            const novelUrl = loadedCheerio(ele)
                .find(".search_title > a")
                .attr("href");

            if (!novelUrl) return;

            const novel = {
                name: novelName,
                cover: novelCover,
                url: novelUrl,
            };

            novels.push(novel);
        });

        return novels;
    }
    async parseNovelAndChapters(novelUrl: string): Promise<Plugin.SourceNovel> {
        const url = novelUrl;

        const result = await fetchApi(url);
        const body = await result.text();

        let loadedCheerio = parseHTML(body);

        const novel: Plugin.SourceNovel = {
            url,
            chapters: [],
        };

        novel.name = loadedCheerio(".seriestitlenu").text();

        novel.cover = loadedCheerio(".seriesimg > img").attr("src");

        novel.author = loadedCheerio("#showauthors").text().trim();

        novel.genres = loadedCheerio("#seriesgenre")
            .children("a")
            .map((i, el) => loadedCheerio(el).text())
            .toArray()
            .join(",");
        novel.status = loadedCheerio("#editstatus").text().includes("Ongoing")
            ? "Ongoing"
            : "Completed";

        let type = loadedCheerio("#showtype").text().trim();

        let summary = loadedCheerio("#editdescription").text().trim();

        novel.summary = summary + `\n\nType: ${type}`;

        let chapter: Plugin.ChapterItem[] = [];

        const novelId = loadedCheerio("input#mypostid").attr("value")!;

        let formData = new FormData();
        formData.append("action", "nd_getchapters");
        formData.append("mygrr", "0");
        formData.append("mypostid", novelId);

        let link = "https://www.novelupdates.com/wp-admin/admin-ajax.php";

        const text = await fetchApi(
            link,
            {
                method: "POST",
                body: formData,
            },
        ).then((data) => data.text());

        loadedCheerio = parseHTML(text);

        loadedCheerio("li.sp_li_chp").each(function () {
            const chapterName = loadedCheerio(this).text().trim();

            const releaseDate = null;

            const chapterUrl =
                "https:" +
                loadedCheerio(this).find("a").first().next().attr("href");

            chapter.push({
                name: chapterName,
                releaseTime: releaseDate,
                url: chapterUrl,
            });
        });

        novel.chapters = chapter.reverse();

        return novel;
    }
    getLocation(href: string) {
        var match = href.match(
            /^(https?:)\/\/(([^:/?#]*)(?::([0-9]+))?)([/]{0,1}[^?#]*)(\?[^#]*|)(#.*|)$/
        );
        return match && `${match[1]}//${match[3]}`;
    }

    async parseChapter(chapterUrl: string): Promise<string> {
        let chapterText = "";

        const result = await fetchApi(
            chapterUrl,
        );
        const body = await result.text();

        // console.log(result.chapterUrl);

        // console.log('Redirected URL: ', result.chapterUrl);

        const loadedCheerio = parseHTML(body);

        let isWuxiaWorld = chapterUrl.toLowerCase().includes("wuxiaworld");

        let isBlogspot = chapterUrl.toLowerCase().includes("blogspot");

        let isTumblr = chapterUrl.toLowerCase().includes("tumblr");

        let isWattpad = chapterUrl.toLowerCase().includes("wattpad");

        let isLightNovelsTls = chapterUrl
            .toLowerCase()
            .includes("lightnovelstranslations");

        let isiNovelTranslation = chapterUrl
            .toLowerCase()
            .includes("inoveltranslation");

        let isTravisTranslation = chapterUrl
            .toLowerCase()
            .includes("travistranslations");

        /**
         * Checks if its a wordpress site
         */
        let isWordPressStr =
            loadedCheerio('meta[name="generator"]').attr("content") ||
            loadedCheerio("footer").text();

        let isWordPress = false;

        if (isWordPressStr) {
            isWordPress =
                isWordPressStr.toLowerCase().includes("wordpress") ||
                isWordPressStr.includes("Site Kit by Google") ||
                loadedCheerio(".powered-by")
                    .text()
                    .toLowerCase()
                    .includes("wordpress");
        }

        let isRainOfSnow = chapterUrl.toLowerCase().includes("rainofsnow");

        let isWebNovel = chapterUrl.toLowerCase().includes("webnovel");

        let isHostedNovel = chapterUrl.toLowerCase().includes("hostednovel");

        let isScribbleHub = chapterUrl.toLowerCase().includes("scribblehub");

        if (isWuxiaWorld) {
            chapterText = loadedCheerio("#chapter-content").html()!;
        } else if (isRainOfSnow) {
            chapterText = loadedCheerio("div.content").html()!;
        } else if (isTumblr) {
            chapterText = loadedCheerio(".post").html()!;
        } else if (isBlogspot) {
            loadedCheerio(".post-share-buttons").remove();
            chapterText = loadedCheerio(".entry-content").html()!;
        } else if (isHostedNovel) {
            chapterText = loadedCheerio(".chapter").html()!;
        } else if (isScribbleHub) {
            chapterText = loadedCheerio("div.chp_raw").html()!;
        } else if (isWattpad) {
            chapterText = loadedCheerio(".container  pre").html()!;
        } else if (isTravisTranslation) {
            chapterText = loadedCheerio(".reader-content").html()!;
        } else if (isLightNovelsTls) {
            chapterText = loadedCheerio(".text_story").html()!;
        } else if (isiNovelTranslation) {
            chapterText = loadedCheerio(".chakra-skeleton").html()!;
        } else if (isWordPress) {
            /**
             * Remove wordpress bloat tags
             */

            const bloatClasses = [
                ".c-ads",
                "#madara-comments",
                "#comments",
                ".content-comments",
                ".sharedaddy",
                ".wp-dark-mode-switcher",
                ".wp-next-post-navi",
                ".wp-block-buttons",
                ".wp-block-columns",
                ".post-cats",
                ".sidebar",
                ".author-avatar",
                ".ezoic-ad",
            ];

            bloatClasses.map((tag) => loadedCheerio(tag).remove());

            chapterText =
                loadedCheerio(".entry-content").html() ||
                loadedCheerio(".single_post").html() ||
                loadedCheerio(".post-entry").html() ||
                loadedCheerio(".main-content").html() ||
                loadedCheerio("article.post").html() ||
                loadedCheerio(".content").html() ||
                loadedCheerio("#content").html() ||
                loadedCheerio(".page-body").html() ||
                loadedCheerio(".td-page-content").html()!;
        } else if (isWebNovel) {
            chapterText = loadedCheerio(".cha-words").html()!;

            if (!chapterText) {
                chapterText = loadedCheerio("._content").html()!;
            }
        } else {
            /**
             * Remove unnecessary tags
             */
            const tags = ["nav", "header", "footer", ".hidden"];

            tags.map((tag) => loadedCheerio(tag).remove());

            chapterText = loadedCheerio("body").html()!;
        }

        if (chapterText) {
            /**
             * Convert relative urls to absolute
             */
            chapterText = chapterText.replace(
                /href="\//g,
                `href="${this.getLocation(chapterUrl)}/`
            );
        }

        return chapterText;
    }
    async searchNovels(searchTerm: string, pageNo: number): Promise<Plugin.NovelItem[]> {
        const url =
            "https://www.novelupdates.com/?s=" +
            searchTerm +
            "&post_type=seriesplans";

        const result = await fetchApi(url);
        const body = await result.text();

        const loadedCheerio = parseHTML(body);

        let novels: Plugin.NovelItem[] = [];

        loadedCheerio("div.search_main_box_nu").each(function () {
            const novelCover = loadedCheerio(this).find("img").attr("src");
            const novelName = loadedCheerio(this).find(".search_title > a").text();
            const novelUrl = loadedCheerio(this)
                .find(".search_title > a")
                .attr("href")
                ?.split("/")[4];

            if (!novelUrl) return;

            novels.push({
                name: novelName,
                url: novelUrl,
                cover: novelCover,
            });
        });
        return novels;
    }
    fetchImage(url: string): Promise<string | undefined> {
        return fetchFile(url);
    }

    filters: Filters = {
        sort: {
            label: "Sort Results By",
            type: FilterTypes.Picker,
            options: [
                { label: "Last Updated", value: "sdate" },
                { label: "Rating", value: "srate" },
                { label: "Rank", value: "srank" },
                { label: "Reviews", value: "sreview" },
                { label: "Chapters", value: "srel" },
                { label: "Title", value: "abc" },
                { label: "Readers", value: "sread" },
                { label: "Frequency", value: "sfrel" },
            ],
            value: "sdate",
        },
        order: {
            label: "Order",
            type: FilterTypes.Picker,
            options: [
                { label: "Descending", value: "desc" },
                { label: "Ascending", value: "asc" },
            ],
            value: "asc"
        },
        storyStatus: {
            label: "Story Status (Translation)",
            type: FilterTypes.Picker,
            options: [
                { label: "All", value: "" },
                { label: "Completed", value: "2" },
                { label: "Ongoing", value: "3" },
                { label: "Hiatus", value: "4" },
            ],
            value: ""
        },
        language: {
            label: "Language",
            options: [
                { label: "Chinese", value: "495" },
                { label: "Filipino", value: "9181" },
                { label: "Indonesian", value: "9179" },
                { label: "Japanese", value: "496" },
                { label: "Khmer", value: "18657" },
                { label: "Korean", value: "497" },
                { label: "Malaysian", value: "9183" },
                { label: "Thai", value: "9954" },
                { label: "Vietnamese", value: "9177" },
            ],
            type: FilterTypes.Picker,
            value: ""
        },
        novelType: {
            label: "Novel Type",
            type: FilterTypes.CheckboxGroup,
            value: [],
            options: [
                { label: "Light Novel", value: "2443" },
                { label: "Published Novel", value: "26874" },
                { label: "Web Novel", value: "2444" },
            ]
        },
        genres: {
            label: "Genres",
            type: FilterTypes.CheckboxGroup,
            value: [],
            options: [
                { label: "Action", value: "8" },
                { label: "Adult", value: "280" },
                { label: "Adventure", value: "13" },
                { label: "Comedy", value: "17" },
                { label: "Drama", value: "9" },
                { label: "Ecchi", value: "292" },
                { label: "Fantasy", value: "5" },
                { label: "Gender Bender", value: "168" },
                { label: "Harem", value: "3" },
                { label: "Historical", value: "330" },
                { label: "Horror", value: "343" },
                { label: "Josei", value: "324" },
                { label: "Martial Arts", value: "14" },
                { label: "Mature", value: "4" },
                { label: "Mecha", value: "10" },
                { label: "Mystery", value: "245" },
                { label: "Psychoical", value: "486" },
                { label: "Romance", value: "15" },
                { label: "School Life", value: "6" },
                { label: "Sci-fi", value: "11" },
                { label: "Seinen", value: "18" },
                { label: "Shoujo", value: "157" },
                { label: "Shoujo Ai", value: "851" },
                { label: "Shounen", value: "12" },
                { label: "Shounen Ai", value: "1692" },
                { label: "Slice of Life", value: "7" },
                { label: "Smut", value: "281" },
                { label: "Sports", value: "1357" },
                { label: "Supernatural", value: "16" },
                { label: "Tragedy", value: "132" },
                { label: "Wuxia", value: "479" },
                { label: "Xianxia", value: "480" },
                { label: "Xuanhuan", value: "3954" },
                { label: "Yaoi", value: "560" },
                { label: "Yuri", value: "922" },
            ]
        }
    }

}

export default new NovelUpdates();