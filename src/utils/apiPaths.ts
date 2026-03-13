// utils/apiPaths.ts

import { getApiUrl } from "@/config/constants";

// Uses getApiUrl() which checks stored custom URL first, then env var, then default
const BASE_API_URL = getApiUrl();

export const API_PATHS = {
  LEADERBOARD: `${BASE_API_URL}leaderboard/`,
  LEADERBOARD_COHORT: (cohorts: number[]) =>
    `${BASE_API_URL}leaderboardcohort/${cohorts.join(",")}/`,
  SERVER_AWARDS: `${BASE_API_URL}awards/`,
  AWARDS: `${BASE_API_URL}awards/`,
  TRACKER: `${BASE_API_URL}tracker/`,
  SERVER_TAG: `${BASE_API_URL}tag/`,
  SERVER_COURSES: `${BASE_API_URL}course/`,
  COURSE_ACTIVITY: (courseId: string) =>
    `${BASE_API_URL}course/${courseId}/activity/`,
  COURSE_INFO: (courseId: string) => `${BASE_API_URL}course/${courseId}`,
  COURSE_STRUCTURE: (shortname: string) =>
    `${BASE_API_URL}coursestructure/${shortname}/`,
  QUIZ_SUBMIT: `${BASE_API_URL}quizattempt/`,
  RESET: `${BASE_API_URL}reset/`,
  REMEMBER_USERNAME: `${BASE_API_URL}username/`,
  REGISTER: `${BASE_API_URL}register/`,
  LOGIN: `${BASE_API_URL}user/`,
  ACTIVITYLOG: `${BASE_API_URL}activitylog/`,
  SERVER_INFO: `${BASE_API_URL}server/`,
  UPDATE_PROFILE: `${BASE_API_URL}profileupdate/`,
  DELETE_ACCOUNT: `${BASE_API_URL}deleteaccount/`,
  DOWNLOAD_ACCOUNT_DATA: `${BASE_API_URL}downloaddata/`,
  CHANGE_PASSWORD: `${BASE_API_URL}password/`,
  USER_COHORTS: `${BASE_API_URL}cohorts/`,
  USER_PROFILE: `${BASE_API_URL}profile/`,
  SEND_OTP: `${BASE_API_URL}sendotp/`,
  CHANNEL: `${BASE_API_URL}channel/`,
  EXTERNALPROFILE: `${BASE_API_URL}externalprofile/`,
  POINTS: `${BASE_API_URL}points/`,
};
