import fs from "fs";
import Jimp = require("jimp");
import fetch from "node-fetch";
import { Response } from "node-fetch";

// import { RequestInfo, RequestInit } from "node-fetch";
// const fetch = (url_string: RequestInfo, init?: RequestInit) =>
//   import("node-fetch").then(({ default: fetch_meth }) =>
//     fetch_meth(url_string, init)
//   );

// filterImageFromURL
// helper function to download, filter, and save the filtered image locally
// returns the absolute path to the local image
// INPUTS
//    inputURL: string - a publicly accessible url to an image file
// RETURNS
//    an absolute path to a filtered image locally saved file
export async function filterImageFromURL(inputURL: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const photo = await Jimp.read(inputURL);
      const outpath =
        "/tmp/filtered." + Math.floor(Math.random() * 2000) + ".jpg";
      await photo
        .resize(256, 256) // resize
        .quality(60) // set JPEG quality
        .greyscale() // set greyscale
        .write(__dirname + outpath, (img) => {
          resolve(__dirname + outpath);
        });
    } catch (error) {
      reject(error);
    }
  });
}

// deleteLocalFiles
// helper function to delete files on the local disk
// useful to cleanup after tasks
// INPUTS
//    files: Array<string> an array of absolute paths to files
export async function deleteLocalFiles(files: Array<string>) {
  for (let file of files) {
    fs.unlinkSync(file);
  }
}

interface FunctionResponse {
  status_code?: number;
  status: boolean;
  message?: string;
  data?: {
    url?: string;
    supported_extensions?: string[];
    response?: Response;
    is_image?: boolean;
  };
  response?: Response;
}

// check if url image extension is a supported image extension. for now, the image urls have to have the image extensions in their paths - if the image url is https://site.com/image15, this service wouldn't fetch the image
function compare_url_with_allowed_image_extensions(
  url: string
): FunctionResponse {
  try {
    let ext_is_supported = false;
    const supported_extensions = ["jpeg", "jpg", "png", "gif"];

    supported_extensions.every((ext) => {
      if (
        Number((url.match(new RegExp(ext, "g")) || { length: 0 }).length) > 0
      ) {
        ext_is_supported = true;
        return false;
      }
      return true;
    });

    if (!ext_is_supported)
      return {
        status: false,
        message: "Image URL does not have an accepted extension for images",
        data: { url, supported_extensions },
      };

    return { status: true };
  } catch (e) {
    return {
      status: false,
      status_code: 500,
      message: e.message,
      data: e.stack,
    };
  }
}

function check_if_content_type_is_image(response: Response): FunctionResponse {
  try {
    const is_image =
      Number(
        (
          response.headers
            .get("content-type")
            .match(new RegExp("image", "g")) || { length: 0 }
        ).length
      ) > 0;

    if (!is_image)
      return {
        status: false,
        message: "URL sent does not link to a valid image",
        data: { response, is_image },
      };

    return { status: true };
  } catch (e) {
    return {
      status: false,
      status_code: 500,
      message: e.message,
      data: e.stack,
    };
  }
}

export async function validateImageUrl(url: string): Promise<FunctionResponse> {
  try {
    // Check if the url has a valid image extension in its string (before fetching the image - saves resources)
    const url_extension_is_valid =
      compare_url_with_allowed_image_extensions(url);
    if (!url_extension_is_valid.status) return url_extension_is_valid;

    // Check is the response is an image
    const response = await fetch(url);
    if (!response.ok)
      return {
        status: false,
        message: `Failed to access URL > ${url}`,
        data: response,
      };

    // Log every request and its content type header
    console.info({
      url,
      content_type_header: response.headers.get("content-type"),
    });

    // Check if the content returned by the fetch call is an image
    const response_is_image = check_if_content_type_is_image(response);
    if (!response_is_image.status) return response_is_image;

    return { status: true, response };
  } catch (e) {
    return {
      status: false,
      status_code: 500,
      message: e.message,
      data: e.stack,
    };
  }
}
