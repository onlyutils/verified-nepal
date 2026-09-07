import { howToStrings, type HowToCopyKey } from "../i18n/how-to.ts";

export type HowToFigureName =
  | "home-desktop"
  | "home-stories"
  | "home-ne-mobile"
  | "get-help-form"
  | "get-help-onbehalf-nudge"
  | "get-help-status"
  | "give-help-board"
  | "give-help-offers"
  | "give-help-group"
  | "give-help-dropoff"
  | "signin"
  | "me-helper"
  | "me-registrant"
  | "poster-board"
  | "poster-detail"
  | "poster-builder"
  | "find-person"
  | "incidents"
  | "report-incident"
  | "projects"
  | "project-detail"
  | "articles"
  | "article-detail"
  | "article-editor"
  | "org-overview"
  | "org-centers"
  | "org-inbound"
  | "org-needs"
  | "org-team"
  | "drop-centers"
  | "drop-center-detail"
  | "donation-status"
  | "ledger"
  | "audit"
  | "desk-guidelines"
  | "desk-queue"
  | "desk-boards"
  | "desk-print"
  | "desk-sync"
  | "desk-flags"
  | "desk-projects"
  | "desk-articles"
  | "desk-stories"
  | "desk-posters"
  | "desk-orgs"
  | "desk-disasters"
  | "desk-admin"
  | "desk-climate"
  | "climate"
  | "info"
  | "not-found"
  | "desk-queue-mobile"
  | "me-helper-mobile";

export type HowToFigure = { name: HowToFigureName; caption: HowToCopyKey };
export type HowToStep = {
  title: HowToCopyKey;
  body: HowToCopyKey;
  see: HowToCopyKey;
  where?: string;
  figures?: readonly HowToFigure[];
};
export type HowToCard = {
  title: HowToCopyKey;
  body: HowToCopyKey;
  figures?: readonly HowToFigure[];
};
export type HowToDefinition = { term: HowToCopyKey; body: HowToCopyKey };
export type HowToSection = {
  id: string;
  title: HowToCopyKey;
  summary: HowToCopyKey;
  paragraphs?: readonly HowToCopyKey[];
  steps?: readonly HowToStep[];
  cards?: readonly HowToCard[];
  definitionsTitle?: HowToCopyKey;
  definitionsIntro?: HowToCopyKey;
  definitions?: readonly HowToDefinition[];
  figures?: readonly HowToFigure[];
  devOnly?: boolean;
};

const figure = (name: HowToFigureName, caption: HowToCopyKey): HowToFigure => ({ name, caption });

export const howToSections: readonly HowToSection[] = [
  {
    id: "what",
    title: "sectionWhat",
    summary: "sectionWhatSummary",
    paragraphs: ["whatParagraph"],
    cards: [
      { title: "whoNeeds", body: "whoNeedsBody" },
      { title: "whoHelper", body: "whoHelperBody" },
      { title: "whoOrg", body: "whoOrgBody" },
      { title: "whoModerator", body: "whoModeratorBody" },
      {
        title: "signInTitle",
        body: "signInBody",
        figures: [
          figure("signin", "captionSignin"),
          figure("me-helper", "captionMeHelper"),
          figure("me-registrant", "captionMeRegistrant"),
          figure("me-helper-mobile", "captionMeHelperMobile"),
        ],
      },
    ],
    definitionsTitle: "codesTitle",
    definitionsIntro: "codesBody",
    definitions: [
      { term: "referenceCode", body: "referenceCodeBody" },
      { term: "claimCode", body: "claimCodeBody" },
      { term: "updateCode", body: "updateCodeBody" },
      { term: "dropOffCode", body: "dropOffCodeBody" },
      { term: "donationCode", body: "donationCodeBody" },
    ],
    figures: [
      figure("home-desktop", "captionHomeDesktop"),
      figure("home-stories", "captionHomeStories"),
      figure("home-ne-mobile", "captionHomeNeMobile"),
    ],
  },
  {
    id: "asking-for-help",
    title: "sectionAsk",
    summary: "sectionAskSummary",
    steps: [
      { title: "askSelf", body: "askSelfBody", see: "seeAskSelf", where: "/get-help", figures: [figure("get-help-form", "captionGetHelpForm")] },
      { title: "askSomeone", body: "askSomeoneBody", see: "seeAskSomeone", where: "/get-help", figures: [figure("get-help-onbehalf-nudge", "captionGetHelpOnBehalf")] },
      { title: "askReference", body: "askReferenceBody", see: "seeAskReference", where: "/get-help" },
      { title: "askStatus", body: "askStatusBody", see: "seeAskStatus", where: "/status/:reference-code", figures: [figure("get-help-status", "captionGetHelpStatus")] },
      { title: "askRenew", body: "askRenewBody", see: "seeAskRenew", where: "/status/:reference-code" },
    ],
  },
  {
    id: "giving-help",
    title: "sectionGive",
    summary: "sectionGiveSummary",
    steps: [
      { title: "giveOffer", body: "giveOfferBody", see: "seeGiveOffer", where: "/give-help", figures: [figure("give-help-offers", "captionGiveHelpOffers")] },
      { title: "giveBoard", body: "giveBoardBody", see: "seeGiveBoard", where: "/give-help", figures: [figure("give-help-board", "captionGiveHelpBoard")] },
      { title: "giveTake", body: "giveTakeBody", see: "seeGiveTake", where: "/give-help", figures: [figure("give-help-group", "captionGiveHelpGroup")] },
      { title: "giveDelivery", body: "giveDeliveryBody", see: "seeGiveDelivery", where: "/give-help", figures: [figure("give-help-dropoff", "captionGiveHelpDropoff")] },
      { title: "giveLedger", body: "giveLedgerBody", see: "seeGiveLedger", where: "/ledger" },
    ],
  },
  {
    id: "missing-people",
    title: "sectionMissing",
    summary: "sectionMissingSummary",
    cards: [
      { title: "missingBuilder", body: "missingBuilderBody", figures: [figure("poster-builder", "captionPosterBuilder")] },
      { title: "missingModeration", body: "missingModerationBody", figures: [figure("poster-board", "captionPosterBoard"), figure("poster-detail", "captionPosterDetail")] },
      { title: "missingTips", body: "missingTipsBody" },
      { title: "missingFind", body: "missingFindBody", figures: [figure("find-person", "captionFindPerson")] },
    ],
  },
  {
    id: "disasters",
    title: "sectionDisasters",
    summary: "sectionDisastersSummary",
    cards: [
      { title: "disastersListed", body: "disastersListedBody", figures: [figure("report-incident", "captionReportIncident")] },
      { title: "disastersApproval", body: "disastersApprovalBody", figures: [figure("incidents", "captionIncidents")] },
      { title: "disastersUrgent", body: "disastersUrgentBody" },
    ],
  },
  {
    id: "community-work",
    title: "sectionCommunity",
    summary: "sectionCommunitySummary",
    cards: [
      { title: "communityProjects", body: "communityProjectsBody", figures: [figure("projects", "captionProjects"), figure("project-detail", "captionProjectDetail")] },
      { title: "communityArticles", body: "communityArticlesBody", figures: [figure("articles", "captionArticles"), figure("article-detail", "captionArticleDetail"), figure("article-editor", "captionArticleEditor")] },
      { title: "communityStories", body: "communityStoriesBody" },
    ],
  },
  {
    id: "organizations",
    title: "sectionOrg",
    summary: "sectionOrgSummary",
    steps: [
      { title: "orgRegister", body: "orgRegisterBody", see: "seeOrgRegister", where: "/register-organization", figures: [figure("org-overview", "captionOrgOverview")] },
      { title: "orgCenters", body: "orgCentersBody", see: "seeOrgCenters", where: "/org", figures: [figure("org-centers", "captionOrgCenters"), figure("org-inbound", "captionOrgInbound")] },
      { title: "orgDonations", body: "orgDonationsBody", see: "seeOrgDonations", where: "/drop-centers", figures: [figure("drop-centers", "captionDropCenters"), figure("drop-center-detail", "captionDropCenterDetail"), figure("donation-status", "captionDonationStatus")] },
      { title: "orgNeeds", body: "orgNeedsBody", see: "seeOrgNeeds", where: "/org", figures: [figure("org-needs", "captionOrgNeeds")] },
      { title: "orgTeam", body: "orgTeamBody", see: "seeOrgTeam", where: "/org", figures: [figure("org-team", "captionOrgTeam")] },
    ],
  },
  {
    id: "the-desk",
    title: "sectionDesk",
    summary: "sectionDeskSummary",
    steps: [
      { title: "deskGuidelines", body: "deskGuidelinesBody", see: "seeDeskGuidelines", where: "/desk", figures: [figure("desk-guidelines", "captionDeskGuidelines")] },
      { title: "deskQueue", body: "deskQueueBody", see: "seeDeskQueue", where: "/desk/queue", figures: [figure("desk-queue", "captionDeskQueue"), figure("desk-queue-mobile", "captionDeskQueueMobile")] },
      { title: "deskBoards", body: "deskBoardsBody", see: "seeDeskBoards", where: "/desk/boards", figures: [figure("desk-boards", "captionDeskBoards")] },
      { title: "deskPaper", body: "deskPaperBody", see: "seeDeskPaper", where: "/desk/print", figures: [figure("desk-print", "captionDeskPrint"), figure("desk-sync", "captionDeskSync")] },
      { title: "deskFlags", body: "deskFlagsBody", see: "seeDeskFlags", where: "/desk/flags", figures: [figure("desk-flags", "captionDeskFlags")] },
      { title: "deskAdmin", body: "deskAdminBody", see: "seeDeskAdmin", where: "/desk/admin", figures: [figure("desk-projects", "captionDeskProjects"), figure("desk-articles", "captionDeskArticles"), figure("desk-stories", "captionDeskStories"), figure("desk-posters", "captionDeskPosters"), figure("desk-orgs", "captionDeskOrganizations"), figure("desk-disasters", "captionDeskDisasters"), figure("desk-admin", "captionDeskAdmin"), figure("desk-climate", "captionDeskClimate")] },
      { title: "deskAudit", body: "deskAuditBody", see: "seeDeskAudit", where: "/audit", figures: [figure("audit", "captionAudit")] },
    ],
  },
  {
    id: "transparency",
    title: "sectionTransparency",
    summary: "sectionTransparencySummary",
    cards: [
      { title: "transparencyLedger", body: "transparencyLedgerBody", figures: [figure("ledger", "captionLedger")] },
      { title: "transparencyGoods", body: "transparencyGoodsBody" },
      { title: "transparencyAudit", body: "transparencyAuditBody", figures: [figure("audit", "captionAudit")] },
      { title: "transparencyClimate", body: "transparencyClimateBody", figures: [figure("climate", "captionClimate")] },
    ],
  },
  {
    id: "language-offline-access",
    title: "sectionCrossCutting",
    summary: "sectionCrossCuttingSummary",
    cards: [
      { title: "crossLanguage", body: "crossLanguageBody" },
      { title: "crossOffline", body: "crossOfflineBody" },
      { title: "crossAccess", body: "crossAccessBody" },
      { title: "crossEmergency", body: "crossEmergencyBody", figures: [figure("info", "captionInfo"), figure("not-found", "captionNotFound")] },
    ],
  },
  {
    id: "glossary",
    title: "sectionGlossary",
    summary: "sectionGlossarySummary",
    cards: [
      { title: "glossaryNeed", body: "glossaryNeed" },
      { title: "glossaryOffer", body: "glossaryOffer" },
      { title: "glossaryClaim", body: "glossaryClaim" },
      { title: "glossaryReference", body: "glossaryReference" },
      { title: "glossaryUpdate", body: "glossaryUpdate" },
      { title: "glossaryDropoff", body: "glossaryDropoff" },
      { title: "glossaryDesk", body: "glossaryDesk" },
      { title: "glossaryGroup", body: "glossaryGroup" },
      { title: "glossaryCenter", body: "glossaryCenter" },
      { title: "glossaryGoods", body: "glossaryGoods" },
      { title: "glossaryAudit", body: "glossaryAudit" },
    ],
  },
  {
    id: "try-it-on-dev",
    title: "sectionTryDev",
    summary: "sectionTryDevSummary",
    paragraphs: ["tryDevIntro"],
    devOnly: true,
    steps: [
      { title: "tryAdmin", body: "tryAdminRole", see: "tryAdminShows" },
      { title: "tryModerator", body: "tryModeratorRole", see: "tryModeratorShows" },
      { title: "tryHelper", body: "tryHelperRole", see: "tryHelperShows" },
      { title: "tryHelper01", body: "tryHelperRole", see: "tryHelper01Shows" },
    ],
  },
];

export function getHowToSections(includeDevSection: boolean): readonly HowToSection[] {
  return howToSections.filter((section) => includeDevSection || !section.devOnly);
}

export type HowToStrings = typeof howToStrings;
