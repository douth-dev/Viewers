import React, { useCallback, useEffect, useRef } from 'react';
import classnames from 'classnames';
import { useNavigate } from 'react-router-dom';
import { MODULE_TYPES } from '@ohif/core';

import Dropzone from 'react-dropzone';
import JSZip from 'jszip';
import filesToStudies from './filesToStudies';

import { extensionManager } from '../../App.tsx';

import { Icon, Button, LoadingIndicatorProgress } from '@ohif/ui';

const getLoadButton = (onDrop, text, isDir) => {
  return (
    <Dropzone onDrop={onDrop} noDrag>
      {({ getRootProps, getInputProps }) => (
        <div {...getRootProps()}>
          <Button
            rounded="full"
            variant="contained" // outlined
            disabled={false}
            endIcon={<Icon name="launch-arrow" />} // launch-arrow | launch-info
            className={classnames('font-medium', 'ml-2')}
            onClick={() => {}}
          >
            {text}
            {isDir ? (
              <input
                {...getInputProps()}
                webkitdirectory="true"
                mozdirectory="true"
              />
            ) : (
              <input {...getInputProps()} />
            )}
          </Button>
        </div>
      )}
    </Dropzone>
  );
};

function Local() {
  const progress = useRef({ total: 0, status: 0 });
  const navigate = useNavigate();
  const dropzoneRef = useRef();
  const [dropInitiated, setDropInitiated] = React.useState(false);
  const [loadingUrls, setLoadingUrls] = React.useState(true);

  // Initializing the dicom local dataSource
  const dataSourceModules = extensionManager.modules[MODULE_TYPES.DATA_SOURCE];
  const localDataSources = dataSourceModules.reduce((acc, curr) => {
    const mods = [];
    curr.module.forEach(mod => {
      if (mod.type === 'localApi') {
        mods.push(mod);
      }
    });
    return acc.concat(mods);
  }, []);

  const firstLocalDataSource = localDataSources[0];
  const dataSource = firstLocalDataSource.createDataSource({});

  const onDrop = useCallback(
    async acceptedFiles => {
      const studies = await filesToStudies(acceptedFiles, dataSource);
      // Todo: navigate to work list and let user select a mode
      const query = new URLSearchParams();
      studies.forEach(id => query.append('StudyInstanceUIDs', id));
      navigate(`/viewer/dicomlocal?${decodeURIComponent(query.toString())}`);
    },
    [dataSource, navigate]
  );

  // Set body style
  useEffect(() => {
    document.body.classList.add('bg-black');
    return () => {
      document.body.classList.remove('bg-black');
    };
  }, []);

  async function createFile(url: string) {
    const response = await fetch(url);
    const data = await response.blob();
    const metadata = {
      type: 'application/dicom',
    };

    progress.current.status++;
    const percentage = (progress.current.status * 100) / progress.current.total;

    document.getElementById('progress').style.width = `${percentage}%`;
    document.getElementById('progress-text').innerText = `${percentage.toFixed(
      1
    )}%`;

    return new File([data], 'x', metadata);
  }

  const createFromZip = useCallback(async (url: string) => {
    const response = await fetch(url);

    const blob = response.blob();
    const zip = await JSZip.loadAsync(blob);

    const tmp = [];
    zip.forEach((_, file) => {
      tmp.push(file);
    });

    progress.current.total = tmp.length;

    const promises = tmp.map(async file => {
      const blob = await file.async('blob');

      return new File([blob], 'x', {
        type: 'application/dicom',
      });
    });

    return Promise.all(promises);
  }, []);

  const createFromJson = useCallback(async (url: string) => {
    const response = await fetch(url);

    const json = await response.json();

    progress.current.total = json.length;

    const promises = json.map((url: string) => createFile(url));
    const files = await Promise.all(promises);

    return files;
  }, []);

  useEffect(() => {
    async function loadImages() {
      const urlSearchParams = new URLSearchParams(window.location.search);
      const params = Object.fromEntries(urlSearchParams.entries());

      if (params.files) {
        progress.current.total = params.files.length;
        const filesUrl = params.files.split(',');

        const promises = filesUrl.map(url => createFile(url));
        const files = await Promise.all(promises);

        onDrop(files);
      } else if (params.json) {
        const files = await createFromJson(params.json);

        onDrop(files);
      } else if (params.zip) {
        const files = await createFromZip(params.json);

        onDrop(files);
      } else {
        setLoadingUrls(false);
      }
    }

    loadImages();
  }, [onDrop, createFromJson, createFromZip]);

  return (
    <Dropzone
      ref={dropzoneRef}
      onDrop={acceptedFiles => {
        setDropInitiated(true);
        onDrop(acceptedFiles);
      }}
      noClick
    >
      {({ getRootProps }) => (
        <div {...getRootProps()} style={{ width: '100%', height: '100%' }}>
          <div className="h-screen w-screen flex justify-center items-center ">
            <div className="py-8 px-8 mx-auto bg-secondary-dark drop-shadow-md space-y-2 rounded-lg">
              <img
                className="block mx-auto h-14"
                src="./ohif-logo.svg"
                alt="OHIF"
              />
              <div className="text-center space-y-2 pt-4">
                {dropInitiated || loadingUrls ? (
                  <div className="flex flex-col items-center justify-center pt-48">
                    <LoadingIndicatorProgress
                      progressByDOM
                      className={'w-full h-full bg-black'}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-blue-300 text-base">
                      Note: You data is not uploaded to any server, it will stay
                      in your local browser application
                    </p>
                    <p className="text-xg text-primary-active font-semibold pt-6">
                      Drag and Drop DICOM files here to load them in the Viewer
                    </p>
                    <p className="text-blue-300 text-lg">Or click to </p>
                  </div>
                )}
              </div>
              <div className="flex justify-around pt-4 ">
                {getLoadButton(onDrop, 'Load files', false)}
                {getLoadButton(onDrop, 'Load folders', true)}
              </div>
            </div>
          </div>
        </div>
      )}
    </Dropzone>
  );
}

export default Local;
