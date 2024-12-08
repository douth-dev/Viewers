import React, { useCallback, useEffect, useRef } from 'react';
import classnames from 'classnames';
import { useNavigate } from 'react-router-dom';
import { DicomMetadataStore, MODULE_TYPES } from '@ohif/core';

import Dropzone from 'react-dropzone';
import JSZip from 'jszip';
import filesToStudies from './filesToStudies';

import { extensionManager } from '../../App.tsx';

import { Icon, Button, LoadingIndicatorProgress } from '@ohif/ui';

const getLoadButton = (onDrop, text, isDir) => {
  return (
    <Dropzone
      onDrop={onDrop}
      noDrag
    >
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

type LocalProps = {
  modePath: string;
};

function Local({ modePath }: LocalProps) {
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

  const microscopyExtensionLoaded = extensionManager.registeredExtensionIds.includes(
    '@ohif/extension-dicom-microscopy'
  );

  const onDrop = useCallback(
    async acceptedFiles => {
      console.log('entrou aqui!');
      const studies = await filesToStudies(acceptedFiles, dataSource);

      const query = new URLSearchParams();

      if (microscopyExtensionLoaded) {
        // TODO: for microscopy, we are forcing microscopy mode, which is not ideal.
        //     we should make the local drag and drop navigate to the worklist and
        //     there user can select microscopy mode
        const smStudies = studies.filter(id => {
          const study = DicomMetadataStore.getStudy(id);
          return (
            study.series.findIndex(s => s.Modality === 'SM' || s.instances[0].Modality === 'SM') >=
            0
          );
        });

        if (smStudies.length > 0) {
          smStudies.forEach(id => query.append('StudyInstanceUIDs', id));

          modePath = 'microscopy';
        }
      }

      // Todo: navigate to work list and let user select a mode
      studies.forEach(id => query.append('StudyInstanceUIDs', id));
      query.append('datasources', 'dicomlocal');
      console.log(`/${modePath}?${decodeURIComponent(query.toString())}`);
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
    document.getElementById('progress-text').innerText = `${percentage.toFixed(1)}%`;

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

  const chunkArray = (array, size) =>
    array.reduce((acc, _, i) => {
      if (i % size === 0) {
        acc.push(array.slice(i, i + size));
      }
      return acc;
    }, []);

  const createFromJson = useCallback(async (url: string) => {
    const response = await fetch(url);

    const json = await response.json();

    progress.current.total = json.length;

    const createFileBatch = async batch => {
      const promises = batch.map((url: string) => createFile(url));
      return await Promise.all(promises);
    };

    const size = 50;
    const files = [];
    const filesChunked = chunkArray(json, size);
    let i = 0;
    while (i < filesChunked.length) {
      const currentStatus = progress.current.status;
      try {
        const processedBatch = await createFileBatch(filesChunked[i]);
        files.push(processedBatch);
        i++;
      } catch (err) {
        progress.current.status = currentStatus;
        console.log(err);
        console.log('try again...');
      }
    }

    return files.flat();
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
        <div
          {...getRootProps()}
          style={{ width: '100%', height: '100%' }}
        >
          <div className="flex h-screen w-screen items-center justify-center ">
            <div className="bg-secondary-dark mx-auto space-y-2 rounded-lg py-8 px-8 drop-shadow-md">
              <div className="flex items-center justify-center">
                <Icon
                  name="logo-dark-background"
                  className="h-28"
                />
              </div>
              <div className="space-y-2 pt-4 text-center">
                {dropInitiated || loadingUrls ? (
                  <div className="flex flex-col items-center justify-center pt-48">
                    <LoadingIndicatorProgress
                      progressByDOM
                      className={'h-full w-full bg-black'}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-base text-blue-300">
                      Note: You data is not uploaded to any server, it will stay in your local
                      browser application
                    </p>
                    <p className="text-xg text-primary-active pt-6 font-semibold">
                      Drag and Drop DICOM files here to load them in the Viewer
                    </p>
                    <p className="text-lg text-blue-300">Or click to </p>
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
