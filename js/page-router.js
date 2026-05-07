(function () {
  function hasMainContent() {
    return Boolean(document.getElementById("mainContent"));
  }

  function normalizePath(path) {
    return path || "./";
  }

  window.renderMain = function renderMain(path) {
    const target = document.getElementById("mainContent");

    if (!target) {
      window.location.href = normalizePath(path);
      return;
    }

    if (window.htmx) {
      window.htmx.ajax("GET", normalizePath(path), {
        target: "#mainContent",
        select: ".blog-page",
        swap: "innerHTML show:window:top",
      });
      return;
    }

    if (typeof window.loadPage === "function") {
      window.loadPage(normalizePath(path));
    }
  };

  document.addEventListener("click", (event) => {
    const link = event.target.closest("[data-main-link]");

    if (!link || !hasMainContent()) return;

    event.preventDefault();
    window.renderMain(link.dataset.mainLink || link.getAttribute("href"));
  });

  document.body?.addEventListener("htmx:afterSwap", (event) => {
    if (event.detail.target?.id !== "mainContent") return;

    if (window.Alpine) {
      window.Alpine.initTree(event.detail.target);
    }
  });

  document.addEventListener("alpine:init", () => {
    window.Alpine.data("buildingLawIndex", () => ({
      articles: [],
      error: "",
      loading: true,
      query: "",

      get embedded() {
        return hasMainContent();
      },

      get pageRoot() {
        if (!this.embedded) return "./";
        return this.$root.dataset.pageRoot || "./building-law/";
      },

      resolveUrl(path) {
        return new URL(path, new URL(this.pageRoot, window.location.href));
      },

      articleHref(article) {
        return this.resolveUrl(article.url).toString();
      },

      articlePath(article) {
        return `${this.pageRoot}${article.url}`;
      },

      get normalizedQuery() {
        return this.query.trim().toLowerCase();
      },

      get filteredArticles() {
        if (!this.normalizedQuery) return this.articles;

        return this.articles.filter((article) => {
          return [article.title, article.desc, article.tag]
            .filter(Boolean)
            .some((value) =>
              value.toString().toLowerCase().includes(this.normalizedQuery),
            );
        });
      },

      async loadArticles() {
        this.loading = true;
        this.error = "";

        try {
          const res = await fetch(this.resolveUrl("articles.json"));

          if (!res.ok) {
            throw new Error(`articles.json 載入失敗：HTTP ${res.status}`);
          }

          this.articles = await res.json();
        } catch (err) {
          console.error(err);
          this.error = err.message || "文章列表載入失敗";
        } finally {
          this.loading = false;
        }
      },
    }));
  });
})();
