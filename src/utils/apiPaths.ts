// utils/apiPaths.ts

import { getApiUrl } from "@/config/constants";

// All API paths now use lazy evaluation to respect custom URL changes at runtime
// When user changes API URL in settings, these will use the new URL without page refresh

export const API_PATHS = {
  LEADERBOARD: () => `${getApiUrl()}leaderboard/`,
  LEADERBOARD_COHORT: (cohorts: number[]) =>
    `${getApiUrl()}leaderboardcohort/${cohorts.join(",")}/`,
  SERVER_AWARDS: () => `${getApiUrl()}awards/`,
  AWARDS: () => `${getApiUrl()}awards/`,
  TRACKER: () => `${getApiUrl()}tracker/`,
  SERVER_TAG: () => `${getApiUrl()}tag/`,
  SERVER_COURSES: () => `${getApiUrl()}course/`,
  COURSE_ACTIVITY: (courseId: string) =>
    `${getApiUrl()}course/${courseId}/activity/`,
  COURSE_INFO: (courseId: string) => `${getApiUrl()}course/${courseId}`,
  COURSE_STRUCTURE: (shortname: string) =>
    `${getApiUrl()}coursestructure/${shortname}/`,
  QUIZ_SUBMIT: () => `${getApiUrl()}quizattempt/`,
  RESET: () => `${getApiUrl()}reset/`,
  REMEMBER_USERNAME: () => `${getApiUrl()}username/`,
  REGISTER: () => `${getApiUrl()}register/`,
  LOGIN: () => `${getApiUrl()}user/`,
  ACTIVITYLOG: () => `${getApiUrl()}activitylog/`,
  SERVER_INFO: () => `${getApiUrl()}server/`,
  UPDATE_PROFILE: () => `${getApiUrl()}profileupdate/`,
  DELETE_ACCOUNT: () => `${getApiUrl()}deleteaccount/`,
  DOWNLOAD_ACCOUNT_DATA: () => `${getApiUrl()}downloaddata/`,
  CHANGE_PASSWORD: () => `${getApiUrl()}password/`,
  USER_COHORTS: () => `${getApiUrl()}cohorts/`,
  USER_PROFILE: () => `${getApiUrl()}profile/`,
  SEND_OTP: () => `${getApiUrl()}sendotp/`,
  CHANNEL: () => `${getApiUrl()}channel/`,
  EXTERNALPROFILE: () => `${getApiUrl()}externalprofile/`,
  POINTS: () => `${getApiUrl()}points/`,
};
