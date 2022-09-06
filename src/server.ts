import express from "express";
import bodyParser from "body-parser";
import {
  filterImageFromURL,
  deleteLocalFiles,
  validateImageUrl,
} from "./util/util";

(async () => {
  // Init the Express application
  const app = express();

  // Set the network port
  const port = process.env.PORT || 8082;

  // Use the body parser middleware for post requests
  app.use(bodyParser.json());

  // @TODO1 IMPLEMENT A RESTFUL ENDPOINT
  // GET /filteredimage?image_url={{URL}}
  // endpoint to filter an image from a public url.
  // IT SHOULD
  //    1
  //    1. validate the image_url query
  //    2. call filterImageFromURL(image_url) to filter the image
  //    3. send the resulting file in the response
  //    4. deletes any files on the server on finish of the response
  // QUERY PARAMATERS
  //    image_url: URL of a publicly accessible image
  // RETURNS
  //   the filtered image file [!!TIP res.sendFile(filteredpath); might be useful]

  /**************************************************************************** */

  //! END @TODO1

  // Root Endpoint
  // Displays a simple message to the user
  app.get("/", async (req, res) => {
    res.send("try GET /filteredimage?image_url={{}}");
  });

  app.get("/filteredimage", async (req, res) => {
    try {
      // Extract and validate image_url query parameter
      const { image_url }: { image_url: string } = req.query;
      if (!image_url)
        return res.status(400).json({
          message:
            "Kindly pass in a valid image URL in the image_url query parameter.",
          data: { image_url },
        });

      // validate image url
      const check_image_response = await validateImageUrl(image_url);
      if (!check_image_response.status) {
        console.error(`URI: '/filteredimage' > validateImageUrl (error) >`, {
          image_url,
          check_image_response,
        });
        return res.status(check_image_response.status_code || 400).json({
          message: check_image_response.message,
          data: !check_image_response.status_code
            ? check_image_response.data
            : undefined,
        });
      }

      const downloaded_image_path = await filterImageFromURL(image_url);
      res.sendFile(downloaded_image_path);
      res.on("finish", () => {
        deleteLocalFiles([downloaded_image_path]);
      });

      return;
    } catch (e) {
      const error_data: any = {};
      if (e instanceof Error)
        error_data.error = {
          message: e.message,
          stack: e.stack,
        };
      else error_data.error = e;

      return res.status(500).json({
        message:
          "An internal server error has occurred. View details in the logs",
        data: error_data,
      });
    }
  });

  // Start the Server
  app.listen(port, () => {
    console.log(`Server running http://localhost:${port}`);
    console.log(`Press CTRL+C to stop server`);
  });
})();
