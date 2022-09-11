import fs from "fs";
import Jimp = require("jimp");
import fetch from "node-fetch";
import { Response } from "node-fetch";
// import express from "express";

// const Express = express();

/**
 * Wraps a callback function in a try catch block and returns a uniform object
 * @param fn callback function to be 'safely' executed
 * @returns (interface) FunctionResponse
 */
export function error_catcher(
  fn: Function
  // {} = { response: Express.response }
): FunctionResponse {
  try {
    return fn();
  } catch (e) {
    const error_data: any = {};
    if (e instanceof Error)
      error_data.error = {
        message: e.message,
        data: e.stack,
        error: e,
      };
    else error_data.error = e;

    return {
      status: false,
      status_code: 500,
      ...error_data.error,
    };
  }
}

// filterImageFromURL
// helper function to download, filter, and save the filtered image locally
// returns the absolute path to the local image
// INPUTS
//    inputURL: string - a publicly accessible url to an image file
// RETURNS
//    an absolute path to a filtered image locally saved file
export async function filterImageFromURL(
  input: string | Buffer
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      // Did this to narrow the possible types to string (Image URL) and buffer (HTTP Response's Content/Data gotten from a prior (node-fetch) HTTP Request to the URL)
      let read_fn;
      if (Buffer.isBuffer(input)) read_fn = Jimp.read(input);
      else if (typeof input === "string") read_fn = Jimp.read(input);

      const photo = await read_fn;
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

export interface FunctionResponse {
  status_code?: number;
  status: boolean;
  message?: string;
  data?: {
    url?: string;
    supported_extensions?: string[];
    response?: Response;
    url_response?: Response;
    is_image?: boolean;
    response_string?: string;
    error_type?: string;
  };
  response?: Response;
  response_buffer?: Buffer;
}

// check if url image extension is a supported image extension. for now, the image urls have to have the image extensions in their paths - if the image url is https://site.com/image15, this service wouldn't fetch the image
function compare_url_with_allowed_image_extensions(
  url: string
): FunctionResponse {
  return error_catcher(() => {
    let ext_is_supported: boolean = false;
    const supported_extensions: string[] = ["jpeg", "jpg", "png", "gif"];

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
  });
}

function check_if_content_type_is_image(response: Response): FunctionResponse {
  return error_catcher(() => {
    const is_image: boolean =
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
  });
}

export async function validateImageUrl(url: string) {
  return error_catcher(async () => {
    // Allow URLs not with an image extension to pass through until traffic becomes an issue

    // Check if the url has a valid image extension in its string (before fetching the image - saves resources)
    // const url_extension_is_valid =
    //   compare_url_with_allowed_image_extensions(url);
    // if (!url_extension_is_valid.status) return url_extension_is_valid;

    // Check is the response is an image
    const response: Response = await fetch(url);
    const response_buffer: Buffer = await response.buffer();
    const response_string: string = response_buffer.toString();
    const is_cloudflare_error: boolean = response_string.includes("cloudflare");

    // console.log({ response_string });

    if (!response.ok && !is_cloudflare_error)
      return {
        status: false,
        message: `Failed to access the image URL`,
        data: { url, response_string },
        status_code: response.status,
      };
    else if (is_cloudflare_error)
      return {
        status: false,
        message: `Failed to access this image as it is protected by cloudflare`,
        data: { url, response_string, error_type: "cloudflare" },
        status_code: response.status,
      };

    // Log every request's image url and its response's content type header
    console.info({
      url,
      content_type_header: response.headers.get("content-type"),
    });

    // Check if the content returned by the fetch call is an image
    const response_is_image: FunctionResponse =
      check_if_content_type_is_image(response);
    if (!response_is_image.status) return response_is_image;

    return { status: true, response, response_buffer };
  });
}
