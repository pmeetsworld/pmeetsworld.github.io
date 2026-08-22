import { COMPLIANCE_ITEMS } from "../config.js?v=1.1.0";
import { createEmptyFieldState } from "../state/schema.js?v=1.1.0";
import { dateKey } from "./dates.js?v=1.1.0";

const SAMPLE_ACCOUNTS = [
  ["10001", "Casey's Kearney", "Casey's #2711", "Kearney", "2711", "Chain"],
  ["10002", "Blue Valley Market", "Blue Valley", "Kearney", "", "Independent"],
  ["10003", "Nebraskaland Truck Center", "Nebraskaland", "Kearney", "", "Independent"],
  ["10004", "Tom's Midwest Liquors", "Tom's", "Grand Island", "", "Independent"],
  ["10005", "Hanks Gas & Grocery", "Hanks", "Grand Island", "", "Independent"],
  ["10006", "Plum Creek Market Place", "Plum Creek", "Lexington", "", "Independent"],
  ["10007", "Walmart Lexington", "Walmart #637", "Lexington", "637", "Chain"],
  ["10008", "Chug A Lug Bar & Grill", "Chug A Lug", "Grand Island", "", "On-Premise"]
];

export function createSampleFieldState() {
  const state = createEmptyFieldState();
  const today = dateKey();

  for (const [accountNumber, name, nickname, town, storeNumber, type] of SAMPLE_ACCOUNTS) {
    const id = `acct_${accountNumber}`;
    state.accounts[id] = {
      id,
      accountNumber,
      name,
      nickname,
      town,
      storeNumber,
      type,
      tags: [],
      frequency: "Weekly",
      buyer: "",
      phone: "",
      email: "",
      address: "",
      objective: "Leave the account clearer than you found it.",
      createdAt: state.createdAt,
      updatedAt: state.createdAt
    };
  }

  state.routes.mon = ["acct_10001", "acct_10002", "acct_10003"];
  state.routes.tue = ["acct_10004", "acct_10005"];
  state.routes.wed = ["acct_10006", "acct_10001"];
  state.routes.thu = ["acct_10007", "acct_10008"];
  state.routes.fri = ["acct_10005", "acct_10004", "acct_10007"];
  state.tasks.task_sample_1 = {
    id: "task_sample_1",
    accountId: "acct_10001",
    title: "Rebates needed",
    details: "Confirm current rebate signage.",
    type: "Elite",
    dueDate: today,
    doneAt: null,
    createdAt: state.createdAt
  };
  state.followUps.follow_sample_1 = {
    id: "follow_sample_1",
    accountId: "acct_10005",
    title: "Confirm cooler placement",
    dueDate: today,
    doneAt: null,
    noteId: null,
    createdAt: state.createdAt
  };
  state.compliance.acct_10002 = Object.fromEntries(
    COMPLIANCE_ITEMS.slice(0, 2).map((item) => [item.id, { completedAt: state.createdAt }])
  );
  state.settings.sampleLoaded = true;
  return state;
}
